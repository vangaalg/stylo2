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
  try {
    // Get the current session to ensure RLS compliance
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[History] Session error:', sessionError);
      return;
    }

    if (!session || !session.user) {
      console.error('[History] No active session found. User must be logged in.');
      return;
    }

    const authenticatedUserId = session.user.id;
    
    // Log for debugging
    console.log('[History] Attempting insert:', {
      passedUserId: userId,
      authenticatedUserId: authenticatedUserId,
      match: userId === authenticatedUserId,
      hasAccessToken: !!session.access_token
    });

    // Use authenticated user ID from session (this is what auth.uid() will return)
    const { data, error } = await supabase
      .from('generated_history')
      .insert([
        { user_id: authenticatedUserId, image_url: imageUrl, style: style }
      ])
      .select(); // Add select to get response data

    if (error) {
      console.error('[History] Insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        authenticatedUserId: authenticatedUserId
      });
      
      if (error.code === '42501' || error.code === 'PGRST301') {
        console.error('[History] RLS Policy Violation Details:', {
          '1. User logged in?': !!session,
          '2. auth.uid() should be': authenticatedUserId,
          '3. user_id being inserted': authenticatedUserId,
          '4. Session valid?': session.expires_at ? new Date(session.expires_at * 1000) > new Date() : 'unknown',
          '5. Access token exists?': !!session.access_token
        });
      }
    } else {
      console.log('[History] Successfully saved:', data);
    }
  } catch (err: any) {
    console.error('[History] Unexpected error:', err);
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
    date: item.created_at,
    rating: item.rating || 0 // Include rating if available
  }));
};

// 4. Update Rating
export const updateRating = async (imageUrl: string, rating: number) => {
  try {
    // We update based on image_url since user might rate from local state list which doesn't have ID handy
    // But image_url is unique enough for this user
    
    // Get current user to ensure RLS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from('generated_history')
      .update({ rating: rating })
      .eq('image_url', imageUrl)
      .eq('user_id', session.user.id); // Double check ownership

    if (error) {
      console.error('Error updating rating:', error);
    } else {
      console.log(`Rated ${rating} stars for ${imageUrl}`);
    }
  } catch (err) {
    console.error('Error in updateRating:', err);
  }
};

// 5. Get Total 5-Star Count (Global)
export const getFiveStarCount = async (): Promise<number> => {
  try {
    // We use a stored function (RPC) because we need count of ALL users, but RLS might block SELECT *
    // If no RPC exists, we can try a direct count if RLS allows reading 'rating' column publicly (unlikely)
    // Or we rely on a specific "public_stats" table.
    // For now, let's try calling the RPC we created in the migration.
    
    const { data, error } = await supabase.rpc('get_five_star_count');
    
    if (error) {
      // Fallback: if RPC fails/doesn't exist, return 0 or mock
      console.warn('Could not fetch 5-star count (RPC missing?):', error.message);
      return 0;
    }
    
    return data as number;
  } catch (err) {
    console.error('Error fetching 5-star count:', err);
    return 0;
  }
};
