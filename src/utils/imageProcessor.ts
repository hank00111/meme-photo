/**
 * Image Processor Utility
 * 
 * Handles EXIF metadata manipulation to ensure uploaded images
 * display the correct upload time in Google Photos.
 * 
 * APPROACH (Binary EXIF Replacement):
 * For JPEG images, we:
 * 1. Remove existing EXIF data from the binary
 * 2. Insert a minimal EXIF segment with current LOCAL datetime
 * 
 * This preserves the original file size and quality while ensuring
 * Google Photos displays the correct upload time (not UTC).
 * 
 * @see https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
 * @see https://www.media.mit.edu/pia/Research/deepview/exif.html
 */

/**
 * JPEG marker constants
 */
const JPEG_APP1 = 0xFFE1; // EXIF data marker
const JPEG_SOS = 0xFFDA;  // Start of Scan (image data starts after this)

/**
 * Remove EXIF metadata and insert current local datetime
 * 
 * For JPEG images: Uses binary manipulation to:
 * 1. Remove existing EXIF segments
 * 2. Insert minimal EXIF with current local datetime
 * 
 * For other formats: Returns original blob as-is.
 * 
 * @param blob - Original image blob (may contain EXIF)
 * @returns New blob with updated EXIF datetime
 */
export async function stripExifMetadata(blob: Blob): Promise<Blob> {
  const mimeType = blob.type;
  
  // Only process JPEG images with binary manipulation
  if (mimeType === 'image/jpeg') {
    console.log(`EXIF_STRIP: Processing JPEG image (${blob.size} bytes)`);
    
    try {
      const processedBlob = await replaceJpegExifWithCurrentTime(blob);
      
      // Log size difference
      const sizeDiff = processedBlob.size - blob.size;
      console.log(`EXIF_STRIP: Processing complete. Size change: ${sizeDiff} bytes`);
      console.log(`EXIF_STRIP: Original: ${blob.size} bytes -> Result: ${processedBlob.size} bytes`);
      
      return processedBlob;
    } catch (error) {
      console.error('EXIF_STRIP_ERROR: Binary processing failed:', error);
      console.log('EXIF_STRIP: Returning original blob');
      return blob;
    }
  }
  
  // For non-JPEG formats, return original
  console.log(`EXIF_STRIP: Non-JPEG format (${mimeType}), passing through original`);
  return blob;
}

/**
 * Replace EXIF data in JPEG with minimal EXIF containing current local time
 * 
 * @param blob - Original JPEG blob
 * @returns JPEG blob with updated EXIF datetime
 */
async function replaceJpegExifWithCurrentTime(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  // Verify JPEG signature (FFD8)
  if (data[0] !== 0xFF || data[1] !== 0xD8) {
    throw new Error('Not a valid JPEG file');
  }
  
  // Build new image:
  // 1. SOI marker
  // 2. New minimal EXIF segment with current datetime
  // 3. All other segments except old APP1 (EXIF)
  const segments: Uint8Array[] = [];
  
  // Add SOI marker
  segments.push(new Uint8Array([0xFF, 0xD8]));
  
  // Add new minimal EXIF with current local datetime
  const exifSegment = createMinimalExifSegment();
  segments.push(exifSegment);
  console.log(`EXIF_STRIP: Created new EXIF segment (${exifSegment.length} bytes) with current local time`);
  
  let offset = 2; // Skip SOI
  
  while (offset < data.length) {
    // Check for marker
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = (data[offset] << 8) | data[offset + 1];
    
    // End of Image
    if (marker === 0xFFD9) {
      segments.push(data.slice(offset));
      break;
    }
    
    // Start of Scan - rest of file is image data
    if (marker === JPEG_SOS) {
      segments.push(data.slice(offset));
      break;
    }
    
    // Skip standalone markers (no length field)
    if (marker >= 0xFFD0 && marker <= 0xFFD7) { // RST0-RST7
      segments.push(data.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    
    // For markers with length field
    if (offset + 4 > data.length) {
      break;
    }
    
    const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
    const segmentEnd = offset + 2 + segmentLength;
    
    if (segmentEnd > data.length) {
      console.warn('EXIF_STRIP: Invalid segment length, stopping parse');
      segments.push(data.slice(offset));
      break;
    }
    
    // Check if this is APP1 (EXIF) segment - SKIP IT
    if (marker === JPEG_APP1) {
      const exifHeader = String.fromCharCode(...data.slice(offset + 4, offset + 10));
      if (exifHeader.startsWith('Exif')) {
        console.log(`EXIF_STRIP: Removing old EXIF segment (${segmentLength} bytes)`);
        offset = segmentEnd;
        continue;
      }
    }
    
    // Copy this segment
    segments.push(data.slice(offset, segmentEnd));
    offset = segmentEnd;
  }
  
  // Combine all segments
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
 * Create a minimal EXIF APP1 segment with current local datetime
 * 
 * EXIF Structure:
 * - APP1 marker (FFE1)
 * - Length (2 bytes, big-endian)
 * - "Exif\0\0" (6 bytes)
 * - TIFF header (8 bytes)
 * - IFD0 (contains pointer to EXIF IFD)
 * - EXIF IFD (contains DateTimeOriginal)
 * 
 * @returns Uint8Array containing complete APP1 segment
 */
function createMinimalExifSegment(): Uint8Array {
  // Get current local datetime in EXIF format: "YYYY:MM:DD HH:MM:SS"
  const now = new Date();
  const dateTimeStr = formatExifDateTime(now);
  console.log(`EXIF_STRIP: Setting EXIF DateTime to: ${dateTimeStr}`);
  
  // DateTime string is 19 chars + null terminator = 20 bytes
  const dateTimeBytes = new TextEncoder().encode(dateTimeStr + '\0');
  
  // Build EXIF data (little-endian for Intel byte order)
  // Structure:
  // - TIFF header: "II" (little-endian) + 0x002A + offset to IFD0 (8)
  // - IFD0: 1 entry (pointer to EXIF IFD) + next IFD offset (0)
  // - EXIF IFD: 3 entries (DateTimeOriginal, DateTimeDigitized, DateTime)
  
  // Calculate offsets (relative to TIFF header start)
  const ifd0Offset = 8;
  const ifd0Entries = 1;
  const ifd0Size = 2 + (ifd0Entries * 12) + 4; // entry count + entries + next IFD offset
  const exifIfdOffset = ifd0Offset + ifd0Size;
  const exifIfdEntries = 3;
  const exifIfdSize = 2 + (exifIfdEntries * 12) + 4;
  const dateTimeDataOffset = exifIfdOffset + exifIfdSize;
  
  // Total TIFF data size
  const tiffDataSize = dateTimeDataOffset + (dateTimeBytes.length * 3);
  
  // Total APP1 size = "Exif\0\0" (6) + TIFF data
  const app1DataSize = 6 + tiffDataSize;
  
  // Build the segment
  const segment = new Uint8Array(2 + 2 + app1DataSize);
  const view = new DataView(segment.buffer);
  let pos = 0;
  
  // APP1 marker
  segment[pos++] = 0xFF;
  segment[pos++] = 0xE1;
  
  // Length (includes length bytes itself)
  view.setUint16(pos, app1DataSize + 2, false); // big-endian for JPEG
  pos += 2;
  
  // Exif header "Exif\0\0"
  segment.set(new TextEncoder().encode('Exif\0\0'), pos);
  pos += 6;
  
  const tiffStart = pos;
  
  // TIFF header (little-endian)
  segment[pos++] = 0x49; // 'I' - Intel byte order
  segment[pos++] = 0x49; // 'I'
  view.setUint16(pos, 0x002A, true); // TIFF magic
  pos += 2;
  view.setUint32(pos, ifd0Offset, true); // Offset to IFD0
  pos += 4;
  
  // IFD0
  view.setUint16(pos, ifd0Entries, true); // Number of entries
  pos += 2;
  
  // IFD0 Entry: ExifIFDPointer (tag 0x8769)
  view.setUint16(pos, 0x8769, true); // Tag
  pos += 2;
  view.setUint16(pos, 4, true); // Type: LONG
  pos += 2;
  view.setUint32(pos, 1, true); // Count
  pos += 4;
  view.setUint32(pos, exifIfdOffset, true); // Value: offset to EXIF IFD
  pos += 4;
  
  // Next IFD offset (0 = no more IFDs)
  view.setUint32(pos, 0, true);
  pos += 4;
  
  // EXIF IFD
  view.setUint16(pos, exifIfdEntries, true); // Number of entries
  pos += 2;
  
  // Entry 1: DateTimeOriginal (tag 0x9003)
  view.setUint16(pos, 0x9003, true); // Tag
  pos += 2;
  view.setUint16(pos, 2, true); // Type: ASCII
  pos += 2;
  view.setUint32(pos, dateTimeBytes.length, true); // Count
  pos += 4;
  view.setUint32(pos, dateTimeDataOffset, true); // Offset to value
  pos += 4;
  
  // Entry 2: DateTimeDigitized (tag 0x9004)
  view.setUint16(pos, 0x9004, true); // Tag
  pos += 2;
  view.setUint16(pos, 2, true); // Type: ASCII
  pos += 2;
  view.setUint32(pos, dateTimeBytes.length, true); // Count
  pos += 4;
  view.setUint32(pos, dateTimeDataOffset + dateTimeBytes.length, true); // Offset
  pos += 4;
  
  // Entry 3: DateTime (tag 0x0132) - main IFD0 tag, some apps use this
  view.setUint16(pos, 0x0132, true); // Tag
  pos += 2;
  view.setUint16(pos, 2, true); // Type: ASCII
  pos += 2;
  view.setUint32(pos, dateTimeBytes.length, true); // Count
  pos += 4;
  view.setUint32(pos, dateTimeDataOffset + dateTimeBytes.length * 2, true); // Offset
  pos += 4;
  
  // Next IFD offset (0 = no more)
  view.setUint32(pos, 0, true);
  pos += 4;
  
  // DateTime values (3 copies for the 3 tags)
  segment.set(dateTimeBytes, tiffStart + dateTimeDataOffset);
  segment.set(dateTimeBytes, tiffStart + dateTimeDataOffset + dateTimeBytes.length);
  segment.set(dateTimeBytes, tiffStart + dateTimeDataOffset + dateTimeBytes.length * 2);
  
  return segment;
}

/**
 * Format a Date object to EXIF datetime format
 * Format: "YYYY:MM:DD HH:MM:SS"
 * 
 * @param date - Date object
 * @returns Formatted datetime string
 */
function formatExifDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}
