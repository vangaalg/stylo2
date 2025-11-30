import { supabase } from './supabaseClient';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const getOrCreateUserProfile = async (userId: string, email: string, sessionId?: string): Promise<User | null> => {
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
      weight: data.weight
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
      isAdmin: newProfile.is_admin
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
    // Convert Data URL to Blob
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    
    const fileName = `${userId}/${uuidv4()}.png`;
    
    const { data, error } = await supabase.storage
      .from('generated-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) throw error;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};

// 2. Save Record to Database
export const saveHistoryItem = async (userId: string, imageUrl: string, style: string) => {
  const { error } = await supabase
    .from('generated_history')
    .insert([
      { user_id: userId, image_url: imageUrl, style: style }
    ]);

  if (error) console.error('Error saving history:', error);
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
