export interface FileInfo {
  /** storage path */
  _id: string;
  /** filename */
  name: string;
  /** file size (in bytes) */
  size: number;
  etag: string;
  lastModified: Date;
}
