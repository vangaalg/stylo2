import { supabase } from './supabaseClient';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const getOrCreateUserProfile = async (userId: string, email: string, sessionId?: string, metadata?: { full_name?: string, avatar_url?: string }): Promise<User | null> => {
  const ADMIN_EMAILS = ['gaurav.vangaal@gmail.com'];
  const shouldBeAdmin = ADMIN_EMAILS.includes(email);

  // 1. Try to get existing profile
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) {
    // Update admin status or session ID if needed
    const updates: any = {};
    if (shouldBeAdmin && !data.is_admin) updates.is_admin = true;
    // If a new session ID is provided, update it (taking over the session)
    if (sessionId && data.last_session_id !== sessionId) updates.last_session_id = sessionId;

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', userId);
      if (updates.is_admin) data.is_admin = true;
    }

    return {
      id: data.id,
      email: data.email,
      credits: data.credits,
      isAdmin: data.is_admin,
      age: data.age,
      height: data.height,
      weight: data.weight,
      name: metadata?.full_name,
      avatar: metadata?.avatar_url
    };
  }

  // 2. If not found, create new profile
  if (error && error.code === 'PGRST116') { 
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert([
        { 
          id: userId, 
          email: email,
          credits: 10, 
          is_admin: shouldBeAdmin,
          last_session_id: sessionId
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return null;
    }

    return {
      id: newProfile.id,
      email: newProfile.email,
      credits: newProfile.credits,
      isAdmin: newProfile.is_admin,
      name: metadata?.full_name,
      avatar: metadata?.avatar_url
    };
  }

  console.error('Error fetching profile:', error);
  return null;
};

export const updateUserDetails = async (userId: string, details: { age?: string, height?: string, weight?: string }) => {
  const { error } = await supabase
    .from('profiles')
    .update(details)
    .eq('id', userId);
    
  if (error) console.error("Failed to update user details:", error);
};

export const checkSessionValidity = async (userId: string, currentSessionId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('profiles')
    .select('last_session_id')
    .eq('id', userId)
    .single();
    
  if (!data) return false;
  
  // If no session ID tracked yet, consider valid (until next login updates it)
  if (!data.last_session_id) return true;
  
  return data.last_session_id === currentSessionId;
};


export const getUserProfile = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    credits: data.credits,
    isAdmin: data.is_admin
  };
};

export const deductCredits = async (userId: string, currentCredits: number, cost: number) => {
  const newBalance = Math.max(0, currentCredits - cost);
  
  const { error } = await supabase
    .from('profiles')
    .update({ credits: newBalance })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
  return newBalance;
};

export const addCredits = async (userId: string, currentCredits: number, amount: number) => {
  const newBalance = currentCredits + amount;
  
  const { error } = await supabase
    .from('profiles')
    .update({ credits: newBalance })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
  return newBalance;
};

// --- History & Storage ---

// 1. Upload Base64 or Blob URL to Supabase Storage
export const uploadImageToStorage = async (userId: string, imageDataUrl: string): Promise<string | null> => {
  try {
    console.log('[Upload] Starting image upload for user:', userId);
    
    // Convert Data URL to Blob
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    console.log('[Upload] Blob created, size:', blob.size, 'bytes');
    
    const fileName = `${userId}/${uuidv4()}.png`;
    console.log('[Upload] Uploading to:', fileName);
    
    // Add timeout wrapper
    const uploadPromise = supabase.storage
      .from('generated-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false
      });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
    );
    
    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

    if (error) {
      console.error('[Upload] Supabase Storage Error:', {
        message: error.message,
        statusCode: error.statusCode,
        name: error.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      alert(`Upload failed: ${error.message || 'Unknown error'}. Check console for details.`);
      throw error;
    }

    if (!data) {
      throw new Error('Upload returned no data and no error (unexpected)');
    }

    console.log('[Upload] Upload successful:', data);

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    console.log('[Upload] Public URL:', publicUrl);
    return publicUrl;
  } catch (error: any) {
    console.error('[Upload] FATAL - Error uploading image:', {
      message: error?.message,
      statusCode: error?.statusCode,
      name: error?.name,
      stack: error?.stack,
      details: error
    });
    
    // Only show alert if it's not a timeout (to avoid spam)
    if (!error?.message?.includes('timeout')) {
      alert(`Image upload failed: ${error?.message || 'Unknown error'}. History will not be saved. Check console for details.`);
    }
    return null;
  }
};

// 2. Save Record to Database
export const saveHistoryItem = async (userId: string, imageUrl: string, style: string) => {
  // Get the current authenticated user to ensure RLS compliance
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('Error saving history: No authenticated user found');
    return;
  }

  if (user.id !== userId) {
    console.warn('Warning: mismatch between passed userId and authenticated user. Using authenticated user ID.');
  }

  const targetUserId = user.id;

  const { error } = await supabase
    .from('generated_history')
    .insert([
      { user_id: targetUserId, image_url: imageUrl, style: style }
    ]);

  if (error) {
    console.error('Error saving history:', error);
    // Add more detailed error logging for debugging 403s
    if (error.code === '42501' || error.code === 'PGRST301') {
       console.error('RLS Policy Violation. Check if:\n1. User is logged in\n2. user_id matches auth.uid()\n3. INSERT policy exists');
    }
  }
};

// 3. Fetch History
export const getUserHistory = async (userId: string) => {
  const { data, error } = await supabase
    .from('generated_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20); // Fetch last 20

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }
  
  return data.map(item => ({
    url: item.image_url,
    style: item.style,
    date: item.created_at
  }));
};
