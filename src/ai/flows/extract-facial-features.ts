'use server';
/**
 * @fileOverview A flow for extracting facial features from an image.
 *
 * - extractFacialFeatures - A function that handles the facial feature extraction process.
 * - ExtractFacialFeaturesInput - The input type for the extractFacialFeatures function.
 * - ExtractFacialFeaturesOutput - The return type for the extractFacialFeatures function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ExtractFacialFeaturesInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a face, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractFacialFeaturesInput = z.infer<typeof ExtractFacialFeaturesInputSchema>;

const ExtractFacialFeaturesOutputSchema = z.object({
  facialFeatures: z.array(z.number()).describe('The extracted facial features as a vector.'),
});
export type ExtractFacialFeaturesOutput = z.infer<typeof ExtractFacialFeaturesOutputSchema>;

export async function extractFacialFeatures(input: ExtractFacialFeaturesInput): Promise<ExtractFacialFeaturesOutput> {
  return extractFacialFeaturesFlow(input);
}

const extractFacialFeaturesPrompt = ai.definePrompt({
  name: 'extractFacialFeaturesPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo of a face, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      facialFeatures: z.array(z.number()).describe('The extracted facial features as a vector.'),
    }),
  },
  prompt: `You are an AI that extracts facial features from an image.

  Analyze the face in the provided photo and extract its key facial features. Represent these features as a vector of floating point numbers.
  Return only the vector of floating point numbers.

  Photo: {{media url=photoDataUri}}`,
});

const extractFacialFeaturesFlow = ai.defineFlow<
  typeof ExtractFacialFeaturesInputSchema,
  typeof ExtractFacialFeaturesOutputSchema
>(
  {
    name: 'extractFacialFeaturesFlow',
    inputSchema: ExtractFacialFeaturesInputSchema,
    outputSchema: ExtractFacialFeaturesOutputSchema,
  },
  async input => {
    const {output} = await extractFacialFeaturesPrompt(input);
    return output!;
  }
);
