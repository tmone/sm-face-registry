// perform-liveness-detection.ts
'use server';

/**
 * @fileOverview Implements a Genkit flow for performing liveness detection using facial landmark analysis.
 *
 * - performLivenessDetection - A function that initiates the liveness detection process.
 * - PerformLivenessDetectionInput - The input type for the performLivenessDetection function.
 * - PerformLivenessDetectionOutput - The return type for the performLivenessDetection function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const PerformLivenessDetectionInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video data URI containing facial movements for liveness detection.  It must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  expectedActions: z
    .array(z.enum(['blink', 'head_left', 'head_right']))
    .describe('An array of actions the user is expected to perform.'),
});
export type PerformLivenessDetectionInput = z.infer<typeof PerformLivenessDetectionInputSchema>;

const PerformLivenessDetectionOutputSchema = z.object({
  isLive: z.boolean().describe('Whether the user is detected as live.'),
  performedActions: z
    .array(z.enum(['blink', 'head_left', 'head_right']))
    .describe('The actions that the user successfully performed.'),
});
export type PerformLivenessDetectionOutput = z.infer<typeof PerformLivenessDetectionOutputSchema>;

export async function performLivenessDetection(input: PerformLivenessDetectionInput): Promise<PerformLivenessDetectionOutput> {
  return performLivenessDetectionFlow(input);
}

const performLivenessDetectionPrompt = ai.definePrompt({
  name: 'performLivenessDetectionPrompt',
  input: {
    schema: z.object({
      videoDataUri: z
        .string()
        .describe(
          "A video data URI containing facial movements for liveness detection.  It must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
      expectedActions: z
        .array(z.enum(['blink', 'head_left', 'head_right']))
        .describe('An array of actions the user is expected to perform.'),
    }),
  },
  output: {
    schema: z.object({
      isLive: z.boolean().describe('Whether the user is detected as live.'),
      performedActions: z
        .array(z.enum(['blink', 'head_left', 'head_right']))
        .describe('The actions that the user successfully performed.'),
    }),
  },
  prompt: `Analyze the video provided to determine if the user is performing the expected actions and is therefore a live person.

  The user is expected to perform the following actions: {{expectedActions}}

  Video: {{media url=videoDataUri}}

  Determine if the user is a live person based on the video and whether they performed the expected actions. Return the actions that the user successfully performed.
  `,
});

const performLivenessDetectionFlow = ai.defineFlow<
  typeof PerformLivenessDetectionInputSchema,
  typeof PerformLivenessDetectionOutputSchema
>(
  {
    name: 'performLivenessDetectionFlow',
    inputSchema: PerformLivenessDetectionInputSchema,
    outputSchema: PerformLivenessDetectionOutputSchema,
  },
  async input => {
    const {output} = await performLivenessDetectionPrompt(input);
    return output!;
  }
);
