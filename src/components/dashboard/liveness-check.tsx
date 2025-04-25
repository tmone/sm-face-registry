'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { performLivenessDetection } from '@/ai/flows/perform-liveness-detection';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";
import { useTranslation } from '@/hooks/use-translation';

interface LivenessCheckProps {
  imageDataUri: string; // Initial image for reference, maybe? Or just start recording?
  onLivenessSuccess: () => void;
  onLivenessFailure: () => void;
}

type LivenessAction = 'blink' | 'head_left' | 'head_right';
const ACTIONS_TO_PERFORM: LivenessAction[] = ['blink', 'head_right']; // Example actions
const RECORDING_DURATION_MS = 5000; // Record for 5 seconds

export default function LivenessCheck({ imageDataUri, onLivenessSuccess, onLivenessFailure }: LivenessCheckProps) {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();


  const startRecording = useCallback(() => {
    if (!webcamRef.current?.stream) {
      setError(t('camera_stream_not_available'));
      toast({ variant: 'destructive', title: t('error'), description: t('camera_stream_not_available') });
      return;
    }
    setError(null);
    setIsRecording(true);
    setProgress(0);
    setCurrentActionIndex(0); // Start with the first action

    mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, {
      mimeType: 'video/webm', // Common format, check browser compatibility
    });

    mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    });

     mediaRecorderRef.current.addEventListener('stop', handleRecordingStop);


    mediaRecorderRef.current.start();

    // Update progress bar
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const currentProgress = Math.min(100, (elapsedTime / RECORDING_DURATION_MS) * 100);
        setProgress(currentProgress);

        // Update required action based on progress (optional, can be time-based)
        // Example: Switch action halfway through
        if (currentProgress > 50 && currentActionIndex === 0 && ACTIONS_TO_PERFORM.length > 1) {
           setCurrentActionIndex(1);
        }

    }, 100);


    // Stop recording after duration
    recordingTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        setProgress(100); // Ensure progress reaches 100
      }
    }, RECORDING_DURATION_MS);

  }, [t, toast]);

  // Moved this outside startRecording to avoid potential stale closures
  const handleRecordingStop = useCallback(async () => {
    setIsRecording(false);
    setIsProcessing(true);

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); // Clear interval if stopped early


    if (recordedChunks.length === 0) {
       setError(t('no_video_data_recorded'));
       toast({ variant: 'destructive', title: t('error'), description: t('no_video_data_recorded') });
       setIsProcessing(false);
       onLivenessFailure(); // Indicate failure
       return;
     }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    setRecordedChunks([]); // Clear chunks after creating blob

    // Convert blob to data URI
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
         toast({ title: t('processing'), description: t('analyzing_video_for_liveness') });
        // Call Genkit flow
        const result = await performLivenessDetection({
          videoDataUri: base64data,
          expectedActions: ACTIONS_TO_PERFORM,
        });

        console.log("Liveness Detection Result:", result);

        // Check if all expected actions were performed
        const allActionsPerformed = ACTIONS_TO_PERFORM.every(action => result.performedActions?.includes(action));


        if (result.isLive && allActionsPerformed) {
          toast({ title: t('success'), description: t('liveness_check_successful') });
          onLivenessSuccess();
        } else {
           let failureReason = t('liveness_check_failed') + ". ";
           if (!result.isLive) failureReason += t('liveness_not_detected') + ". ";
           if (!allActionsPerformed) {
             const missingActions = ACTIONS_TO_PERFORM.filter(action => !result.performedActions?.includes(action));
             failureReason += `${t('missing_actions')}: ${missingActions.map(a => t(a)).join(', ')}.`; // Translate action names
           }
           setError(failureReason);
           toast({ variant: 'destructive', title: t('failed'), description: failureReason });
           onLivenessFailure();
        }
      } catch (err) {
        console.error('Liveness detection error:', err);
        setError(t('error_during_liveness_detection'));
        toast({ variant: 'destructive', title: t('error'), description: t('error_during_liveness_detection') });
        onLivenessFailure();
      } finally {
        setIsProcessing(false);
      }
    };
     reader.onerror = (error) => {
       console.error("FileReader error:", error);
       setError(t('failed_to_process_video_data'));
       toast({ variant: 'destructive', title: t('error'), description: t('failed_to_process_video_data') });
       setIsProcessing(false);
       onLivenessFailure();
     };
  }, [recordedChunks, onLivenessSuccess, onLivenessFailure, t, toast]); // Add dependencies


  // Cleanup timeouts/intervals on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
         mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleUserMedia = () => {
    setCameraReady(true);
    setError(null);
  };

  const handleUserMediaError = (error: string | DOMException) => {
    console.error("Webcam error:", error);
     let errorMessage = t('failed_to_access_webcam');
     if (typeof error === 'string') {
       errorMessage = error;
     } else if (error.name === "NotAllowedError") {
       errorMessage = t('webcam_permission_denied');
     } else if (error.name === "NotFoundError") {
       errorMessage = t('no_webcam_found');
     }
    setError(errorMessage);
    setCameraReady(false);
    toast({ variant: "destructive", title: t('webcam_error'), description: errorMessage });
    onLivenessFailure(); // Fail if camera error occurs
  };

  const getCurrentActionInstruction = () => {
     if (!isRecording || isProcessing) return t('get_ready_for_liveness_check');
     const action = ACTIONS_TO_PERFORM[currentActionIndex];
     switch(action) {
        case 'blink': return t('please_blink_your_eyes');
        case 'head_left': return t('please_turn_your_head_left');
        case 'head_right': return t('please_turn_your_head_right');
        default: return t('follow_instructions');
     }
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <p className="text-lg font-semibold text-center">{t('liveness_check')}</p>
       <p className="text-sm text-muted-foreground text-center">{t('follow_instructions_ensure_liveness')}</p>

      {error && !isProcessing && (
        <p className="text-destructive text-center flex items-center gap-1"><AlertTriangle size={16} /> {error}</p>
      )}

      <div className="relative w-full max-w-md aspect-video bg-secondary rounded-lg overflow-hidden border">
          <Webcam
              audio={false} // Audio not needed for liveness
              ref={webcamRef}
              className="absolute inset-0 w-full h-full object-cover"
              videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
           />
           {!cameraReady && !error && (
             <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
               {t('initializing_camera')}...
             </div>
           )}
           {isProcessing && (
               <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white">
                 <Loader2 className="h-8 w-8 animate-spin" />
                 <p className="ml-2">{t('analyzing')}...</p>
               </div>
           )}
            {(isRecording || (!isRecording && !isProcessing && !error)) && cameraReady && (
               <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded text-center text-sm font-medium">
                   {getCurrentActionInstruction()}
               </div>
           )}
      </div>

        {isRecording && (
            <div className="w-full max-w-md">
                <Progress value={progress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground text-center mt-1">{Math.round(progress)}%</p>
            </div>
        )}

      <div className="flex space-x-4">
        {!isRecording && !isProcessing && (
            <>
              <Button onClick={startRecording} disabled={!cameraReady || !!error}>
                 {t('start_liveness_check')}
              </Button>
               <Button onClick={onLivenessFailure} variant="outline">
                    {t('cancel')}
                </Button>
            </>

        )}
         {isRecording && !isProcessing && (
            <Button onClick={() => mediaRecorderRef.current?.stop()} variant="destructive">
                {t('stop_recording')}
            </Button>
         )}

      </div>
    </div>
  );
}
