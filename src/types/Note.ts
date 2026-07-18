export interface Note {
  id: string;
  customerId: string;
  treatmentTypeId?: string;
  /** Treatment type name — denormalized from API */
  treatmentTypeName?: string;
  /** Content of the note (API field name) */
  content?: string;
  /** Kept as alias for backward compatibility with mock data */
  text?: string;
  /** Server-derived user id of the author */
  userId?: string;
  /** Kept as alias for backward compatibility with mock data */
  authorUserId?: string;
  /** Snapshot of the author's name at writing time */
  writtenByFullName?: string;
  /** ISO date string — note date (API field name) */
  noteDate?: string;
  /** Kept as alias for backward compatibility with mock data */
  createdDate?: string;
}
