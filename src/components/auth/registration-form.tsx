'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

const registrationSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  employeeId: z.string().min(1, { message: 'Employee ID is required.' }),
  department: z.enum(['SM', 'MS'], { required_error: 'Department is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export default function RegistrationForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: '',
      email: '',
      employeeId: '',
      department: undefined,
      password: '',
    },
  });

  const onSubmit = async (values: RegistrationFormValues) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Store additional user info in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: values.fullName,
        email: values.email,
        employeeId: values.employeeId,
        department: values.department,
        faceRegistered: false, // Initially face is not registered
      });

      toast({
        title: t('registration_successful'),
        description: t('account_created_successfully'),
      });
      // Optionally redirect or clear form
      form.reset();

    } catch (error: any) {
      console.error('Registration error:', error);
      const errorCode = error.code;
      let errorMessage = t('registration_failed_try_again');
      if (errorCode === 'auth/email-already-in-use') {
        errorMessage = t('email_already_in_use');
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = t('password_too_weak');
      }
      toast({
        variant: 'destructive',
        title: t('registration_failed'),
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('full_name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('enter_full_name')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={t('enter_email')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('employee_id')}</FormLabel>
              <FormControl>
                <Input placeholder={t('enter_employee_id')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('department')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_department')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SM">SM</SelectItem>
                  <SelectItem value="MS">MS</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('enter_password')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('register')}
        </Button>
      </form>
    </Form>
  );
}
