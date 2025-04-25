
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, updateDoc, setDoc, DocumentSnapshot, FirestoreError } from 'firebase/firestore'; // Added setDoc, specific types
import { db, storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import WebcamCapture from './webcam-capture';
import LivenessCheck from './liveness-check';
import { extractFacialFeatures } from '@/ai/flows/extract-facial-features';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail, Building, CheckCircle, AlertCircle, WifiOff, ShieldAlert, Briefcase } from 'lucide-react'; // Added Briefcase, refined imports
import { useTranslation } from '@/hooks/use-translation';


interface UserData {
  uid: string; // Ensure uid is part of the interface
  fullName: string;
  email: string;
  employeeId: string;
  department: string;
  faceRegistered: boolean;
  faceImageUrl?: string;
  facialFeatures?: number[]; // Add facial features if stored
}

export default function Dashboard() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // Start loading initially
  const [showWebcam, setShowWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [livenessCheckRequired, setLivenessCheckRequired] = useState(false);
  const [isOffline, setIsOffline] = useState(false); // Initialize offline state
  const [fetchError, setFetchError] = useState<string | null>(null); // State to store specific fetch error message
  const { toast } = useToast();
  const { t } = useTranslation();

   // Initialize offline state based on browser status on mount
   useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
   }, []);


  const fetchUserData = useCallback(async () => {
    if (!user) {
      console.log("Dashboard: User object is null, skipping data fetch.");
      setLoading(false); // Stop loading if no user
      setUserData(null);
      setFetchError(null);
      return;
    }

    setLoading(true);
    setFetchError(null); // Reset fetch error on new attempt

    const currentOnlineStatus = typeof navigator !== 'undefined' && navigator.onLine;
    setIsOffline(!currentOnlineStatus); // Update based on current status
    console.log(`Dashboard: Attempting to fetch data for user: ${user.uid}. Online: ${currentOnlineStatus}`);


    if (!currentOnlineStatus) {
      console.warn(`Dashboard: Client is offline (UID: ${user.uid}). Attempting to read from cache.`);
      // Keep existing UI error message if already set to offline, otherwise set it.
      if (fetchError !== t('offline_message')) {
        setFetchError(t('offline_message'));
      }
      // Do not set loading to false immediately, let getDoc attempt cache read.
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      console.log(`Dashboard: Fetching Firestore document: users/${user.uid}`);
      // Attempt to get the document. If offline and persistence is working,
      // this might return cached data. If cache is empty or persistence fails,
      // it might throw an 'unavailable' error.
      const userDocSnap: DocumentSnapshot = await getDoc(userDocRef); // Use DocumentSnapshot type

      if (userDocSnap.exists()) {
        const fetchedData = userDocSnap.data() as Omit<UserData, 'uid'>; // Firestore data doesn't include uid by default
        const completeUserData: UserData = { uid: user.uid, ...fetchedData }; // Add uid explicitly
        setUserData(completeUserData);
        // Clear fetch error ONLY if we successfully got data (even from cache)
        setFetchError(null);
        // Update offline status based on cache source *only* if we are online
        // If we are offline, trust the navigator.onLine status primarily
        if (currentOnlineStatus) {
            setIsOffline(userDocSnap.metadata.fromCache);
        }
        console.log(`Dashboard: User data fetched successfully for ${user.uid}. From Cache: ${userDocSnap.metadata.fromCache}`);
      } else {
        console.warn(`Dashboard: User document not found for UID: ${user.uid}.`);
        setUserData(null); // User doc doesn't exist
        setFetchError(t('user_data_not_found'));
        toast({ variant: "destructive", title: t('error'), description: t('user_data_not_found_contact_admin') });
      }
    } catch (error: any) {
        const typedError = error as FirestoreError; // Type assertion
      // Log detailed error including code and message
      console.error(`Dashboard: Error fetching user data for UID: ${user.uid}:`, typedError);

       if (typedError.code && typedError.message) {
            console.error(`Dashboard: Firestore Error Code: ${typedError.code}, Message: ${typedError.message}`);
       } else {
            console.error("Dashboard: Caught non-Firestore error:", typedError);
       }

      let description = t('failed_to_fetch_user_data');
      let uiError = t('failed_to_fetch_user_data_generic'); // Default UI error
      let isCurrentlyOfflineError = false;

      // Check for common errors like offline or permission denied
      if (typedError.code === 'unavailable') {
        console.warn(`Dashboard: Firestore operation failed: Client reported as offline during fetch (UID: ${user.uid}).`);
        isCurrentlyOfflineError = true;
        description = t('offline_message');
        uiError = t('offline_message'); // Set specific UI error for offline
        // Don't toast excessively if already known to be offline (based on navigator)
        if (!isOffline) { // Only toast if we *thought* we were online
             toast({ variant: "warning", title: t('offline_title'), description: description });
        }
      } else if (typedError.code === 'permission-denied') {
        console.error("Dashboard: Firestore Permission Denied. Check Firestore security rules.");
        description = t('permission_denied_error');
        uiError = t('permission_denied_error_check_rules'); // More specific UI message
        toast({ variant: "destructive", title: t('error'), description });
      } else if (typedError.code === 'invalid-argument') { // Use Firestore error code directly
         console.error("Dashboard: Firestore Invalid Argument. Possibly related to query or data structure.");
         description = t('firestore_invalid_argument');
         uiError = t('firestore_error_contact_admin');
         toast({ variant: "destructive", title: t('error'), description });
      }
      else {
        // Generic error toast for unexpected issues
        console.error("Dashboard: Unexpected error fetching user data:", typedError);
        toast({ variant: "destructive", title: t('error'), description });
      }

      // Update state based on the error
      setIsOffline(isCurrentlyOfflineError || !navigator.onLine); // Ensure offline state reflects error or navigator status
      setFetchError(uiError); // Set specific error message for UI

      // **Important**: Only clear userData if the error is *not* just being offline ('unavailable').
      // If offline, we want to keep potentially cached data displayed.
      if (!isCurrentlyOfflineError) {
         setUserData(null);
         console.log("Dashboard: Cleared user data due to non-offline error.");
      } else {
          console.log("Dashboard: Keeping potentially cached user data while offline error occurred.");
          // If userData is null even after offline error, it means cache was empty/inaccessible
          if (!userData) {
              console.log("Dashboard: No cached user data was available during offline error.");
          }
      }

    } finally {
      setLoading(false); // Stop loading regardless of outcome
      console.log("Dashboard: fetchUserData finished.");
    }
  }, [user, toast, t, userData, fetchError, isOffline]); // Added fetchError, isOffline - review dependencies if needed


  useEffect(() => {
    console.log("Dashboard: Mount/User change effect running.");
    fetchUserData(); // Fetch data when component mounts or user changes

    // Add network status listeners (only on client)
    const setupNetworkListeners = () => {
        const handleOnline = () => {
          console.log("Dashboard: Network status changed: Online");
          setIsOffline(false);
          // Clear only the offline error message, keep other potential errors
          if (fetchError === t('offline_message')) {
            setFetchError(null);
            console.log("Dashboard: Cleared offline error message.");
          }
          // Refetch data only if it wasn't loaded previously or if there was *any* fetch error
          if (!userData || fetchError) {
            console.log("Dashboard: Network back online, refetching user data...");
            fetchUserData(); // Trigger refetch
          } else {
             console.log("Dashboard: Network back online, but data already seems loaded. No automatic refetch.");
          }
        };
        const handleOffline = () => {
          console.log("Dashboard: Network status changed: Offline");
          setIsOffline(true);
          setFetchError(t('offline_message')); // Set offline message for UI
          // Show toast only when transitioning to offline state
          toast({ variant: "warning", title: t('offline_title'), description: t('offline_functionality_limited') });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup listeners on component unmount
        return () => {
          console.log("Dashboard: Cleaning up network listeners.");
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
    };

    let cleanupListeners: (() => void) | undefined;
    if (typeof window !== 'undefined') {
        cleanupListeners = setupNetworkListeners();
    }

    // Rerun effect if fetchUserData callback changes (due to user, t, toast)
    return cleanupListeners; // Return the cleanup function
  }, [user, fetchUserData, toast, t]); // Dependencies carefully chosen


  const handleImageCapture = (imageSrc: string) => {
    setCapturedImage(imageSrc);
    setShowWebcam(false);
    setLivenessCheckRequired(true); // Proceed to liveness check
  };

  const handleLivenessSuccess = async () => {
     if (!capturedImage || !user || !userData) return; // Need userData for update

     setProcessing(true);
     setLivenessCheckRequired(false);
     try {
        // 1. Extract facial features using Genkit Flow
        toast({ title: t('processing'), description: t('extracting_facial_features') });
        const { facialFeatures } = await extractFacialFeatures({ photoDataUri: capturedImage });

        if (!facialFeatures || facialFeatures.length === 0) {
            throw new Error(t('failed_to_extract_features'));
        }
        console.log("Dashboard: Facial features extracted:", facialFeatures.length);

        // 2. Upload image to Firebase Storage
        toast({ title: t('processing'), description: t('uploading_image') });
        const imageRef = ref(storage, `faceImages/${user.uid}.jpg`);
        // Use uploadString with data URL directly (Firebase SDK handles base64 decoding)
        await uploadString(imageRef, capturedImage, 'data_url');
        const imageUrl = await getDownloadURL(imageRef);
        console.log("Dashboard: Image uploaded:", imageUrl);

        // 3. Update Firestore document
        toast({ title: t('processing'), description: t('saving_registration_data') });
        const userDocRef = doc(db, 'users', user.uid);
        const updateData: Partial<UserData> = {
            faceRegistered: true,
            faceImageUrl: imageUrl,
            facialFeatures: facialFeatures, // Store the extracted features
        };
        await updateDoc(userDocRef, updateData);
        console.log("Dashboard: Firestore document updated.");

        // 4. Update local state immediately for UI responsiveness
        setUserData(prev => prev ? { ...prev, ...updateData } : null);
        setCapturedImage(null); // Clear captured image after successful registration

        toast({ title: t('success'), description: t('face_registered_successfully') });

     } catch (error: any) {
        console.error("Dashboard: Error registering face:", error);
         let errorMessage = t('failed_to_register_face_generic');
         if (error.message === t('failed_to_extract_features')) {
             errorMessage = t('could_not_detect_face');
         } else if (error.code === 'storage/unauthorized' || error.code === 'permission-denied') {
             errorMessage = t('storage_permission_error'); // Specific message for storage/firestore permissions
             console.error("Dashboard: Permission error during face registration. Check Storage/Firestore rules.");
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


  // --- Render Logic ---

  // 1. Initial Loading State (Only show if no data and no specific error yet)
  if (loading && !userData && !fetchError) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <span className="ml-2">{t('loading_user_data')}...</span>
        </div>
    );
  }

  // 2. Error State (and no cached data available)
  // Show error primarily if userData is *still* null after loading attempt.
  if (fetchError && !userData) {
     const Icon = fetchError === t('offline_message') ? WifiOff : ShieldAlert;
     const title = fetchError === t('offline_message') ? t('offline_title') : t('error_loading_data');
     const descriptionColor = fetchError === t('offline_message') ? 'text-muted-foreground' : 'text-destructive';
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4">
            <Icon className={`h-16 w-16 mb-4 ${descriptionColor}`} />
            <h2 className="text-xl font-semibold mb-2">{title}</h2>
            <p className={`${descriptionColor}`}>{fetchError}</p>
            {/* Specific guidance based on error */}
            {fetchError === t('offline_message') && <p className="text-sm text-muted-foreground mt-2">{t('check_connection_try_again')}</p>}
            {fetchError === t('permission_denied_error_check_rules') && <p className="text-sm text-muted-foreground mt-2">{t('check_firestore_rules')}</p>}
            {fetchError === t('user_data_not_found_contact_admin') && <p className="text-sm text-muted-foreground mt-2">{t('contact_support_if_issue_persists')}</p>}
             {fetchError === t('firestore_error_contact_admin') && <p className="text-sm text-muted-foreground mt-2">{t('contact_support_if_issue_persists')}</p>}
            {/* Manual retry button */}
             <Button onClick={fetchUserData} className="mt-4" variant="outline" disabled={loading}>
                 {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('retry')}
             </Button>
        </div>
    );
  }

  // 3. Data Loaded State (userData is available, might still show offline/error banner)
  return userData ? (
    <div className="container mx-auto p-4 md:p-8">
       {/* Inline Offline/Error Indicator (shown alongside data if applicable) */}
       {isOffline && (
         <div className="mb-4 p-2 text-center text-sm bg-orange-100 text-orange-800 rounded border border-orange-200 flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" /> {t('offline_data_stale')}
         </div>
       )}
        {/* Show non-offline errors even with cached data */}
       {fetchError && fetchError !== t('offline_message') && (
           <div className="mb-4 p-2 text-center text-sm bg-red-100 text-red-800 rounded border border-red-200 flex items-center justify-center gap-2">
               <AlertCircle className="h-4 w-4" /> {fetchError}
               <Button onClick={fetchUserData} size="sm" variant="ghost" className="ml-2 h-6 px-2 text-red-800 hover:bg-red-200" disabled={loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : t('retry')}
               </Button>
           </div>
       )}

        <h1 className="mb-6 text-3xl font-bold text-center">{t('dashboard')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Information Card */}
          <Card className="shadow-md rounded-lg overflow-hidden">
            <CardHeader className="bg-card">
              <CardTitle className="flex items-center gap-2 text-xl"><User className="text-primary"/>{t('user_information')}</CardTitle>
              <CardDescription>{t('your_profile_details')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
               <div className="flex items-center gap-3"><User className="w-5 h-5 text-muted-foreground"/><div><strong>{t('full_name')}:</strong> {userData.fullName}</div></div>
               <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-muted-foreground"/><div><strong>{t('email')}:</strong> {userData.email}</div></div>
               <div className="flex items-center gap-3"><Briefcase className="w-5 h-5 text-muted-foreground"/><div><strong>{t('employee_id')}:</strong> {userData.employeeId}</div></div>
               <div className="flex items-center gap-3"><Building className="w-5 h-5 text-muted-foreground"/><div><strong>{t('department')}:</strong> {userData.department}</div></div>
               <div className="flex items-center gap-2 mt-4 border-t pt-4">
                    <strong>{t('face_registration')}:</strong>
                    {userData.faceRegistered ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle className="w-4 h-4" /> {t('registered')}</span>
                    ) : (
                         <span className="flex items-center gap-1 text-orange-600 font-medium"><AlertCircle className="w-4 h-4" /> {t('not_registered')}</span>
                    )}
               </div>
               {userData.faceRegistered && userData.faceImageUrl && (
                    <div className="mt-4 text-center">
                        <p className="text-sm font-medium mb-2">{t('registered_face_image')}:</p>
                        <img src={userData.faceImageUrl} alt={t('registered_face')} className="mx-auto h-32 w-32 rounded-full object-cover border-2 border-primary shadow-md" />
                    </div>
               )}
            </CardContent>
          </Card>

          {/* Face Registration Card */}
          <Card className="shadow-md rounded-lg overflow-hidden">
            <CardHeader className="bg-card">
              <CardTitle className="text-xl">{t('face_registration')}</CardTitle>
               <CardDescription>
                 {userData.faceRegistered ? t('face_already_registered_update') : t('register_your_face_for_identification')}
               </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 p-6 min-h-[300px]"> {/* Adjusted min-height */}
              {processing && (
                 <div className="flex flex-col items-center space-y-2 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>{t('processing_face_registration')}...</p>
                     <p className="text-sm text-muted-foreground">{t('this_may_take_a_moment')}</p>
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
              {/* Area to show button/preview when not actively capturing/processing */}
              {!processing && !livenessCheckRequired && !showWebcam && (
                 <div className="flex flex-col items-center space-y-4">
                     {/* Show preview only if image exists and is not being processed */}
                     {capturedImage && (
                          <div className="text-center">
                              <p className="text-sm font-medium mb-2">{t('preview_image')}:</p>
                              <img src={capturedImage} alt={t('captured_face_preview')} className="mx-auto h-40 w-40 rounded-lg object-cover border mb-2 shadow-sm" />
                               {/* Liveness check starts automatically, no button needed here */}
                          </div>
                      )}
                     {/* Show registration button only if conditions met */}
                     {!capturedImage && (
                         <Button
                            onClick={() => setShowWebcam(true)}
                            disabled={processing || showWebcam || livenessCheckRequired || isOffline}
                            size="lg"
                         >
                            {userData.faceRegistered ? t('update_face') : t('register_face')}
                         </Button>
                     )}
                     {/* Show guidance text */}
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                          {userData.faceRegistered ? t('update_face_instruction') : t('register_face_instruction')}
                      </p>
                 </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  ) : (
      // 4. Handle case where user is logged in, not loading, no error, but userData is still null
      // This might happen briefly or if the user doc genuinely doesn't exist. Render loading state.
      <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">{t('loading_user_data')}...</span>
      </div>
  );
}
