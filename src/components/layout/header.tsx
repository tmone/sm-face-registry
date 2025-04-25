'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, Languages } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LanguageSwitcher from './language-switcher';
import { useTranslation } from '@/hooks/use-translation';


export default function Header() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();


  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: t('logged_out'), description: t('logged_out_successfully') });
      // Auth state change will handle UI update
    } catch (error) {
      console.error('Logout error:', error);
      toast({ variant: 'destructive', title: t('logout_failed'), description: t('failed_to_log_out') });
    }
  };

  // Get first letter for avatar fallback
   const getInitials = (email?: string | null) => {
     return email ? email.charAt(0).toUpperCase() : <User className="h-5 w-5" />;
   };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          {/* Placeholder for a potential logo */}
           {/* <Command className="h-6 w-6" /> */}
          <span className="font-bold sm:inline-block">
            FaceRegistry
          </span>
        </Link>

        <div className="flex items-center gap-4">
           <LanguageSwitcher />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {/* Add AvatarImage if user profile pic exists */}
                    {/* <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'} /> */}
                    <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName || t('user')}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Add links to profile/settings if needed */}
                {/* <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t('settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator /> */}
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {/* Login/Register buttons could go here if needed, but handled by Tabs on page.tsx */}
              {/* <Button variant="ghost">Login</Button> */}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
