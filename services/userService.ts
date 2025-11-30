import { supabase } from './supabaseClient';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const getOrCreateUserProfile = async (userId: string, email: string): Promise<User | null> => {
  // 1. Try to get existing profile
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) {
    return {
      id: data.id,
      email: data.email,
      credits: data.credits,
      isAdmin: data.is_admin
    };
  }

  // 2. If not found, create new profile with 10 free credits
  if (error && error.code === 'PGRST116') { // Code for no rows found
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert([
        { 
          id: userId, 
          email: email,
          credits: 10, // Free Trial Credits
          is_admin: false 
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
