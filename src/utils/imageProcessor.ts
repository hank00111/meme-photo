/**
 * EXIF metadata manipulation for Google Photos uploads.
 * For JPEG: removes existing EXIF and inserts minimal segment with current local datetime.
 * 
 * @see https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
 * @see https://www.media.mit.edu/pia/Research/deepview/exif.html
 */

const JPEG_APP1 = 0xFFE1; // EXIF marker
const JPEG_SOS = 0xFFDA;  // Start of Scan

/**
 * Strip EXIF and insert current local datetime. Non-JPEG formats returned unchanged.
 */
export async function stripExifMetadata(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/jpeg') {
    try {
      return await replaceJpegExifWithCurrentTime(blob);
    } catch {
      return blob;
    }
  }
  return blob;
}

/** Replace EXIF data in JPEG with minimal EXIF containing current local time */
async function replaceJpegExifWithCurrentTime(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  if (data[0] !== 0xFF || data[1] !== 0xD8) {
    throw new Error('Not a valid JPEG file');
  }
  
  const segments: Uint8Array[] = [];
  segments.push(new Uint8Array([0xFF, 0xD8])); // SOI
  
  const exifSegment = createMinimalExifSegment();
  segments.push(exifSegment);
  
  let offset = 2;
  
  while (offset < data.length) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = (data[offset] << 8) | data[offset + 1];
    
    if (marker === 0xFFD9 || marker === JPEG_SOS) {
      segments.push(data.slice(offset));
      break;
    }
    
    // RST0-RST7: standalone markers without length field
    if (marker >= 0xFFD0 && marker <= 0xFFD7) {
      segments.push(data.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    
    if (offset + 4 > data.length) {
      break;
    }
    
    const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
    const segmentEnd = offset + 2 + segmentLength;
    
    if (segmentEnd > data.length) {
      segments.push(data.slice(offset));
      break;
    }
    
    // Skip existing EXIF segment
    if (marker === JPEG_APP1 && String.fromCharCode(...data.slice(offset + 4, offset + 10)).startsWith('Exif')) {
      offset = segmentEnd;
      continue;
    }
    
    segments.push(data.slice(offset, segmentEnd));
    offset = segmentEnd;
  }
  
  const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
  const result = new Uint8Array(totalLength);
  let resultOffset = 0;
  
  for (const segment of segments) {
    result.set(segment, resultOffset);
    resultOffset += segment.length;
  }
  
  return new Blob([result], { type: 'image/jpeg' });
}

/**
 * Create minimal EXIF APP1 segment with current local datetime.
 * Structure: APP1 marker + Length + "Exif\0\0" + TIFF header + IFD0 + EXIF IFD
 */
function createMinimalExifSegment(): Uint8Array {
  const now = new Date();
  const dateTimeStr = formatExifDateTime(now);
  const dateTimeBytes = new TextEncoder().encode(dateTimeStr + '\0'); // 19 chars + null
  
  const ifd0Offset = 8;
  const ifd0Entries = 1;
  const ifd0Size = 2 + (ifd0Entries * 12) + 4;
  const exifIfdOffset = ifd0Offset + ifd0Size;
  const exifIfdEntries = 3;
  const exifIfdSize = 2 + (exifIfdEntries * 12) + 4;
  const dateTimeDataOffset = exifIfdOffset + exifIfdSize;
  const tiffDataSize = dateTimeDataOffset + (dateTimeBytes.length * 3);
  const app1DataSize = 6 + tiffDataSize; // "Exif\0\0" + TIFF data
  
  const segment = new Uint8Array(2 + 2 + app1DataSize);
  const view = new DataView(segment.buffer);
  let pos = 0;
  
  // APP1 marker + length
  segment[pos++] = 0xFF;
  segment[pos++] = 0xE1;
  view.setUint16(pos, app1DataSize + 2, false);
  pos += 2;
  
  // EXIF header
  segment.set(new TextEncoder().encode('Exif\0\0'), pos);
  pos += 6;
  const tiffStart = pos;
  
  // TIFF header (little-endian)
  segment[pos++] = 0x49;
  segment[pos++] = 0x49;
  view.setUint16(pos, 0x002A, true);
  pos += 2;
  view.setUint32(pos, ifd0Offset, true);
  pos += 4;
  
  // IFD0: pointer to EXIF IFD (tag 0x8769)
  view.setUint16(pos, ifd0Entries, true);
  pos += 2;
  view.setUint16(pos, 0x8769, true);
  pos += 2;
  view.setUint16(pos, 4, true);
  pos += 2;
  view.setUint32(pos, 1, true);
  pos += 4;
  view.setUint32(pos, exifIfdOffset, true);
  pos += 4;
  view.setUint32(pos, 0, true);
  pos += 4;
  
  // EXIF IFD: DateTimeOriginal (0x9003), DateTimeDigitized (0x9004), DateTime (0x0132)
  view.setUint16(pos, exifIfdEntries, true);
  pos += 2;
  
  // DateTimeOriginal
  view.setUint16(pos, 0x9003, true);
  pos += 2;
  view.setUint16(pos, 2, true);
  pos += 2;
  view.setUint32(pos, dateTimeBytes.length, true);
  pos += 4;
  view.setUint32(pos, dateTimeDataOffset, true);
  pos += 4;
  
  // DateTimeDigitized
  view.setUint16(pos, 0x9004, true);
  pos += 2;
  view.setUint16(pos, 2, true);
  pos += 2;
  view.setUint32(pos, dateTimeBytes.length, true);
  pos += 4;
  view.setUint32(pos, dateTimeDataOffset + dateTimeBytes.length, true);
  pos += 4;
  
  // DateTime
  view.setUint16(pos, 0x0132, true);
  pos += 2;
  view.setUint16(pos, 2, true);
  pos += 2;
  view.setUint32(pos, dateTimeBytes.length, true);
  pos += 4;
  view.setUint32(pos, dateTimeDataOffset + dateTimeBytes.length * 2, true);
  pos += 4;
  
  view.setUint32(pos, 0, true);
  pos += 4;
  
  // DateTime values (3 copies)
  segment.set(dateTimeBytes, tiffStart + dateTimeDataOffset);
  segment.set(dateTimeBytes, tiffStart + dateTimeDataOffset + dateTimeBytes.length);
  segment.set(dateTimeBytes, tiffStart + dateTimeDataOffset + dateTimeBytes.length * 2);
  
  return segment;
}

/** Format Date to EXIF format: "YYYY:MM:DD HH:MM:SS" */
function formatExifDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}
