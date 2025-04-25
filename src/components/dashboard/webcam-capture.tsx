'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Camera, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';

interface WebcamCaptureProps {
  onCapture: (imageSrc: string) => void;
  onCancel: () => void;
}

export default function WebcamCapture({ onCapture, onCancel }: WebcamCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();


  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setImgSrc(imageSrc);
      } else {
         toast({ variant: 'destructive', title: t('error'), description: t('failed_to_capture_image') });
      }
    }
  }, [webcamRef, toast, t]);

  const retake = () => {
    setImgSrc(null);
  };

  const confirmCapture = () => {
    if (imgSrc) {
      onCapture(imgSrc);
    }
  };

  const handleUserMedia = () => {
     console.log("Camera stream started");
     setCameraReady(true);
     setError(null); // Clear any previous error
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
  };


  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {error && (
         <p className="text-destructive text-center">{error}</p>
      )}
      <div className="relative w-full max-w-md aspect-video bg-secondary rounded-lg overflow-hidden border">
        {!imgSrc ? (
           <>
             <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="absolute inset-0 w-full h-full object-cover"
                videoConstraints={{ facingMode: "user" }}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
             />
            {!cameraReady && !error && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
                   {t('initializing_camera')}...
                 </div>
               )}
           </>

        ) : (
          <img src={imgSrc} alt={t('captured_image')} className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="flex space-x-4">
        {!imgSrc ? (
          <>
            <Button onClick={capture} disabled={!cameraReady || !!error} variant="outline" size="icon">
              <Camera className="h-5 w-5" />
              <span className="sr-only">{t('capture_photo')}</span>
            </Button>
            <Button onClick={onCancel} variant="destructive" size="icon">
               <X className="h-5 w-5" />
               <span className="sr-only">{t('cancel')}</span>
             </Button>
          </>

        ) : (
          <>
            <Button onClick={retake} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" /> {t('retake')}
            </Button>
            <Button onClick={confirmCapture} className="bg-primary hover:bg-primary/90">
              {t('confirm_and_proceed')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
