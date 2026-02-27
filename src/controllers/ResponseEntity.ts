/**
 * Generic Response wrapper matching LLD ResponseEntity type.
 */
export interface ResponseEntity<T = any> {
    status: number;
    data?: T;
    message?: string;
    error?: string;
}
