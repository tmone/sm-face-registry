'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import RegistrationForm from '@/components/auth/registration-form';
import LoginForm from '@/components/auth/login-form';
import Dashboard from '@/components/dashboard/dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';

export default function Home() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">{t('loading')}...</div>;
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      {user ? (
        <Dashboard />
      ) : (
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">{t('welcome_to_face_registry')}</CardTitle>
             <CardDescription className="text-center">{t('please_login_or_register')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('login')}</TabsTrigger>
                <TabsTrigger value="register">{t('register')}</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register">
                <RegistrationForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
