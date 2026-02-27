import { Event } from '../core/event/Event';
import { VectorGenerationException } from './Exceptions';

/**
 * Interfaces with the embedding model to convert text to vectors 
 * and performs similarity calculations.
 */
export class VectorService {
    public readonly EMBEDDING_DIM: number = 1536; // Constant size
    public modelEndpoint: string = 'https://api.openai.com/v1/embeddings';

    /**
     * Concatenates InterestTags + Last N joined events.
     * Returns User Vector ("DNA").
     */
    public async generateUserEmbedding(tags: string[], history: Event[]): Promise<number[]> {
        try {
            // Stub implementation
            return new Array(this.EMBEDDING_DIM).fill(0.1);
        } catch (error) {
            throw new VectorGenerationException();
        }
    }

    /**
     * Concatenates Title, Category, SubCategory, Description.
     * Returns Event Vector.
     */
    public async generateEventEmbedding(event: Event): Promise<number[]> {
        try {
            // Stub implementation
            return new Array(this.EMBEDDING_DIM).fill(0.5);
        } catch (error) {
            throw new VectorGenerationException();
        }
    }

    /**
     * Similarity: Returns score -1.0 to 1.0. Used for ranking & merging.
     */
    public calculateSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length || vecA.length === 0) return 0;

        // Dot product / magnitude (Cosine similarity stub)
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct; // Mocked, must return -1.0 to 1.0
    }

    /**
     * Group Logic Helper: Calculates the centroid of multiple user vectors
     * to create a "Group Composite Vector".
     */
    public weightedAverage(vectors: number[][]): number[] {
        if (vectors.length === 0) return [];
        const dim = vectors[0].length;
        const result = new Array(dim).fill(0);

        for (const vec of vectors) {
            for (let i = 0; i < dim; i++) {
                result[i] += vec[i];
            }
        }
        return result.map(val => val / vectors.length);
    }
}
