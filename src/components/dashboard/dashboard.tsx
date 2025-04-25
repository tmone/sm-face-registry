'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import WebcamCapture from './webcam-capture';
import LivenessCheck from './liveness-check';
import { extractFacialFeatures } from '@/ai/flows/extract-facial-features';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail, Building, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';


interface UserData {
  fullName: string;
  email: string;
  employeeId: string;
  department: string;
  faceRegistered: boolean;
  faceImageUrl?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWebcam, setShowWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [livenessCheckRequired, setLivenessCheckRequired] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        setLoading(true);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as UserData);
          } else {
             toast({ variant: "destructive", title: t('error'), description: t('user_data_not_found') });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast({ variant: "destructive", title: t('error'), description: t('failed_to_fetch_user_data') });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user, toast, t]);

  const handleImageCapture = (imageSrc: string) => {
    setCapturedImage(imageSrc);
    setShowWebcam(false);
    setLivenessCheckRequired(true); // Proceed to liveness check
  };

  const handleLivenessSuccess = async () => {
     if (!capturedImage || !user) return;

     setProcessing(true);
     setLivenessCheckRequired(false);
     try {
        // 1. Extract facial features using Genkit Flow
        const { facialFeatures } = await extractFacialFeatures({ photoDataUri: capturedImage });

        if (!facialFeatures || facialFeatures.length === 0) {
            throw new Error(t('failed_to_extract_features'));
        }

        // 2. Upload image to Firebase Storage
        const imageRef = ref(storage, `faceImages/${user.uid}.jpg`);
        await uploadString(imageRef, capturedImage.split(',')[1], 'base64', { contentType: 'image/jpeg' });
        const imageUrl = await getDownloadURL(imageRef);

        // 3. Update Firestore document
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
            faceRegistered: true,
            faceImageUrl: imageUrl,
            facialFeatures: facialFeatures, // Store the extracted features
        });

        // 4. Update local state
        setUserData(prev => prev ? { ...prev, faceRegistered: true, faceImageUrl: imageUrl } : null);
        setCapturedImage(null); // Clear captured image after successful registration

        toast({ title: t('success'), description: t('face_registered_successfully') });

     } catch (error: any) {
        console.error("Error registering face:", error);
         let errorMessage = t('failed_to_register_face');
         if (error.message === t('failed_to_extract_features')) {
             errorMessage = t('could_not_detect_face');
         }
        toast({ variant: "destructive", title: t('error'), description: errorMessage });
        // Reset states if registration fails
        setCapturedImage(null);
     } finally {
        setProcessing(false);
     }
  };

  const handleLivenessFailure = () => {
    setProcessing(false);
    setLivenessCheckRequired(false);
    setCapturedImage(null); // Discard image if liveness fails
    toast({ variant: "destructive", title: t('liveness_check_failed'), description: t('please_try_capturing_again') });
  };


  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!userData) {
    return <div className="flex h-screen items-center justify-center text-destructive">{t('failed_to_load_user_data')}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
        <h1 className="mb-6 text-3xl font-bold text-center">{t('dashboard')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Information Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="text-primary"/>{t('user_information')}</CardTitle>
              <CardDescription>{t('your_profile_details')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
               <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground"/><strong>{t('full_name')}:</strong> {userData.fullName}</div>
               <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground"/><strong>{t('email')}:</strong> {userData.email}</div>
               <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground"/><strong>{t('employee_id')}:</strong> {userData.employeeId}</div>
               <div className="flex items-center gap-2"><Building className="w-4 h-4 text-muted-foreground"/><strong>{t('department')}:</strong> {userData.department}</div>
               <div className="flex items-center gap-2">
                    <strong>{t('face_registration')}:</strong>
                    {userData.faceRegistered ? (
                        <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4" /> {t('registered')}</span>
                    ) : (
                         <span className="flex items-center gap-1 text-orange-600"><AlertCircle className="w-4 h-4" /> {t('not_registered')}</span>
                    )}
               </div>
               {userData.faceRegistered && userData.faceImageUrl && (
                    <div className="mt-4 text-center">
                        <img src={userData.faceImageUrl} alt={t('registered_face')} className="mx-auto h-32 w-32 rounded-full object-cover border-2 border-primary" />
                    </div>
               )}
            </CardContent>
          </Card>

          {/* Face Registration Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>{t('face_registration')}</CardTitle>
               <CardDescription>
                 {userData.faceRegistered ? t('face_already_registered_update') : t('register_your_face_for_identification')}
               </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              {processing && (
                 <div className="flex flex-col items-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>{t('processing_face_registration')}...</p>
                 </div>
              )}
              {!processing && livenessCheckRequired && capturedImage && (
                 <LivenessCheck
                   imageDataUri={capturedImage}
                   onLivenessSuccess={handleLivenessSuccess}
                   onLivenessFailure={handleLivenessFailure}
                 />
              )}
              {!processing && !livenessCheckRequired && showWebcam && (
                <WebcamCapture onCapture={handleImageCapture} onCancel={() => setShowWebcam(false)} />
              )}
              {!processing && !livenessCheckRequired && !showWebcam && (
                 <>
                 {capturedImage && !userData.faceRegistered && (
                      <div className="text-center">
                          <img src={capturedImage} alt={t('captured_face_preview')} className="mx-auto h-40 w-40 rounded-lg object-cover border mb-2" />
                          <p className="text-sm text-muted-foreground">{t('preview_image')}</p>
                      </div>
                  )}
                  <Button onClick={() => setShowWebcam(true)} disabled={processing || showWebcam || livenessCheckRequired}>
                    {userData.faceRegistered ? t('update_face') : t('register_face')}
                  </Button>
                 </>

              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
