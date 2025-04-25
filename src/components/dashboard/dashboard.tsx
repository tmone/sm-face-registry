
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, User, Mail, Building, CheckCircle, AlertCircle, WifiOff, ShieldAlert } from 'lucide-react'; // Added WifiOff, ShieldAlert
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine); // Initialize based on browser status
  const [fetchError, setFetchError] = useState<string | null>(null); // State to store specific fetch error message
  const { toast } = useToast();
  const { t } = useTranslation();

  const fetchUserData = useCallback(async () => {
    if (user) {
      setLoading(true);
      setFetchError(null); // Reset fetch error on new attempt
      // Update offline status based on current navigator state before fetching
      const currentlyOffline = !navigator.onLine;
      setIsOffline(currentlyOffline);

      console.log(`Attempting to fetch data for user: ${user.uid}. Online status: ${!currentlyOffline}`);

      if (currentlyOffline) {
           console.warn(`Client is offline (UID: ${user.uid}). Skipping Firestore fetch.`);
           setFetchError(t('offline_message')); // Set specific error message for UI
           setLoading(false);
           // Keep existing userData if available, otherwise it remains null
           return;
      }


      try {
        const userDocRef = doc(db, 'users', user.uid);
        console.log(`Fetching Firestore document: users/${user.uid}`);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const fetchedData = userDocSnap.data() as UserData;
          setUserData(fetchedData);
          console.log("User data fetched successfully:", fetchedData);
          setFetchError(null); // Clear error on success
        } else {
           console.warn(`User document not found for UID: ${user.uid}. User might be logged in, but Firestore data is missing.`);
           setUserData(null); // Ensure userData is null if doc doesn't exist
           setFetchError(t('user_data_not_found'));
           toast({ variant: "destructive", title: t('error'), description: t('user_data_not_found') });
        }
      } catch (error: any) {
         console.error(`Error fetching user data for UID: ${user?.uid}:`, error);
         // Log the specific error code and message
         console.error(`Firestore Error Code: ${error.code}, Message: ${error.message}`);

         let description = t('failed_to_fetch_user_data');
         let uiError = t('failed_to_fetch_user_data'); // Separate message for UI state

         if (error.code === 'unavailable') {
             console.warn(`Firestore operation failed: Client reported as offline during fetch (UID: ${user?.uid}).`);
             setIsOffline(true); // Set offline state
             description = t('offline_message');
             uiError = t('offline_message');
             // Avoid toast here as the UI will show the offline state
         } else if (error.code === 'permission-denied') {
             console.error("Firestore Permission Denied. Check Firestore security rules.");
             description = t('permission_denied_error');
             uiError = t('permission_denied_error_check_rules'); // More specific UI message
             toast({ variant: "destructive", title: t('error'), description });
         } else {
              // Generic error toast for unexpected issues
             toast({ variant: "destructive", title: t('error'), description });
         }
         setUserData(null); // Clear data on error
         setFetchError(uiError); // Set specific error message for UI
      } finally {
        setLoading(false);
      }
    } else {
      // Handle case where user is null (e.g., logged out, or auth state not yet ready)
      console.log("User is null or auth state not ready, skipping data fetch.");
      setLoading(false); // Ensure loading stops if user is null initially
      setUserData(null);
      setFetchError(null); // Clear any previous errors
      setIsOffline(!navigator.onLine); // Update offline status based on browser
    }
  }, [user, toast, t]); // Removed userData from dependencies to avoid refetch loops on data update

  useEffect(() => {
    fetchUserData(); // Fetch data when component mounts or user changes

    // Add network status listeners
    const handleOnline = () => {
        console.log("Network status changed: Online");
        setIsOffline(false);
        setFetchError(null); // Clear potential offline error message
        // Refetch data only if it wasn't loaded previously or if there was a fetch error
        if (!userData || fetchError) {
             console.log("Network back online, refetching user data...");
             fetchUserData();
        }
    };
    const handleOffline = () => {
         console.log("Network status changed: Offline");
         setIsOffline(true);
         setFetchError(t('offline_message')); // Set offline message for UI
         // Show toast only when transitioning to offline state
         toast({ variant: "destructive", title: t('offline_title'), description: t('offline_message') });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup listeners on component unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // Run effect when fetchUserData (which depends on user, t, toast) changes
  }, [fetchUserData, userData, fetchError, t, toast]);


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
        toast({ title: t('processing'), description: t('extracting_facial_features') });
        const { facialFeatures } = await extractFacialFeatures({ photoDataUri: capturedImage });

        if (!facialFeatures || facialFeatures.length === 0) {
            throw new Error(t('failed_to_extract_features'));
        }
        console.log("Facial features extracted:", facialFeatures.length);

        // 2. Upload image to Firebase Storage
        toast({ title: t('processing'), description: t('uploading_image') });
        const imageRef = ref(storage, `faceImages/${user.uid}.jpg`);
        await uploadString(imageRef, capturedImage.split(',')[1], 'base64', { contentType: 'image/jpeg' });
        const imageUrl = await getDownloadURL(imageRef);
        console.log("Image uploaded:", imageUrl);

        // 3. Update Firestore document
        toast({ title: t('processing'), description: t('saving_registration_data') });
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
            faceRegistered: true,
            faceImageUrl: imageUrl,
            facialFeatures: facialFeatures, // Store the extracted features
        });
        console.log("Firestore document updated.");

        // 4. Update local state
        setUserData(prev => prev ? { ...prev, faceRegistered: true, faceImageUrl: imageUrl } : null);
        setCapturedImage(null); // Clear captured image after successful registration

        toast({ title: t('success'), description: t('face_registered_successfully') });

     } catch (error: any) {
        console.error("Error registering face:", error);
         let errorMessage = t('failed_to_register_face');
         if (error.message === t('failed_to_extract_features')) {
             errorMessage = t('could_not_detect_face');
         } else if (error.code === 'storage/unauthorized' || error.code === 'permission-denied') {
             errorMessage = t('storage_permission_error'); // Specific message for storage/firestore permissions
             console.error("Permission error during face registration. Check Storage/Firestore rules.");
         } else if (error.code) {
            // Include Firebase/other error code if available
            errorMessage += ` (${t('error_code')}: ${error.code})`;
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
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">{t('loading_user_data')}...</span></div>;
  }

  // Display specific error message if fetching failed
  if (fetchError && !userData) { // Show error only if there's no user data loaded
     const Icon = fetchError === t('offline_message') ? WifiOff : ShieldAlert;
     const title = fetchError === t('offline_message') ? t('offline_title') : t('error_loading_data');
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4">
            <Icon className={`h-16 w-16 mb-4 ${fetchError === t('offline_message') ? 'text-muted-foreground' : 'text-destructive'}`} />
            <h2 className="text-xl font-semibold mb-2">{title}</h2>
            <p className={`${fetchError === t('offline_message') ? 'text-muted-foreground' : 'text-destructive'}`}>{fetchError}</p>
            {/* Suggest retry or checking connection/rules based on error */}
            {fetchError === t('offline_message') && <p className="text-sm text-muted-foreground mt-2">{t('check_connection_try_again')}</p>}
            {fetchError === t('permission_denied_error_check_rules') && <p className="text-sm text-muted-foreground mt-2">{t('check_firestore_rules')}</p>}
            {fetchError === t('user_data_not_found') && <p className="text-sm text-muted-foreground mt-2">{t('contact_support_if_issue_persists')}</p>}
             {/* Optionally add a manual retry button */}
             <Button onClick={fetchUserData} className="mt-4" variant="outline">{t('retry')}</Button>
        </div>
    );
  }

  // Render dashboard only if userData is available
  return userData ? (
    <div className="container mx-auto p-4 md:p-8">
       {/* Show a subtle offline indicator when offline but data is available */}
       {isOffline && (
         <div className="mb-4 p-2 text-center text-sm bg-orange-100 text-orange-800 rounded border border-orange-200 flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" /> {t('offline_data_stale')}
         </div>
       )}
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
            <CardContent className="flex flex-col items-center justify-center space-y-4 min-h-[200px]"> {/* Added min-height */}
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
                 {/* Only show preview if an image was just captured but not yet processed/registered */}
                 {capturedImage && !livenessCheckRequired && (
                      <div className="text-center">
                          <img src={capturedImage} alt={t('captured_face_preview')} className="mx-auto h-40 w-40 rounded-lg object-cover border mb-2" />
                          <p className="text-sm text-muted-foreground">{t('preview_image')}</p>
                          {/* Button to proceed was removed, logic now goes directly to liveness check */}
                      </div>
                  )}
                 {/* Show button only if not capturing, not doing liveness, and not processing */}
                 {!capturedImage && !livenessCheckRequired && (
                     <Button onClick={() => setShowWebcam(true)} disabled={processing || showWebcam || livenessCheckRequired || isOffline}>
                        {userData.faceRegistered ? t('update_face') : t('register_face')}
                     </Button>
                 )}

                 </>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  ) : null; // Return null if userData is null and not loading (and no fetch error)
}
