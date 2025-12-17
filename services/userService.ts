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
      avatar: metadata?.avatar_url,
      hasPurchasedIntroPack: data.has_purchased_intro_pack || false
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
          credits: 3, 
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
      avatar: metadata?.avatar_url,
      hasPurchasedIntroPack: newProfile.has_purchased_intro_pack || false
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
export const uploadImageToStorage = async (
  userId: string, 
  imageDataUrl: string, 
  userEmail?: string,
  style?: string
): Promise<string | null> => {
  try {
    console.log('[Upload] Starting image upload for user:', userId);
    
    // Convert Data URL to Blob
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    console.log('[Upload] Blob created, size:', blob.size, 'bytes');
    
    // Get username from email (part before @)
    const username = userEmail 
      ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') 
      : 'user';
    
    // Format date/time: YYYYMMDD_HHMMSS
    const now = new Date();
    const dateStr = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0]; // Format: 20231215_143025
    
    // Create filename: username_YYYYMMDD_HHMMSS_style.png
    const stylePart = style ? `_${style.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const fileName = `${userId}/${username}_${dateStr}${stylePart}.png`;
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
export const saveHistoryItem = async (userId: string, imageUrl: string, style: string, userEmail?: string) => {
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
    
    // Get email from session if not provided
    const email = userEmail || session.user.email || '';
    
    // Get current date/time
    const currentDateTime = new Date().toISOString();
    
    // Log for debugging
    console.log('[History] Attempting insert:', {
      passedUserId: userId,
      authenticatedUserId: authenticatedUserId,
      email: email,
      dateTime: currentDateTime,
      match: userId === authenticatedUserId,
      hasAccessToken: !!session.access_token
    });

    // Use authenticated user ID from session (this is what auth.uid() will return)
    const { data, error } = await supabase
      .from('generated_history')
      .insert([
        { 
          user_id: authenticatedUserId, 
          image_url: imageUrl, 
          style: style,
          user_email: email,
          created_at: currentDateTime
        }
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
      return null;
    } else {
      console.log('[History] Successfully saved:', data);
      // Return the first item's ID (should only be one)
      return data && data.length > 0 ? data[0].id : null;
    }
  } catch (err: any) {
    console.error('[History] Unexpected error:', err);
    return null;
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
    id: item.id, // Include history ID for linking to support tickets
    url: item.image_url,
    style: item.style,
    date: item.created_at,
    email: item.user_email || '',
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

// --- Transactions ---

// Save transaction
export const saveTransaction = async (
  userId: string,
  razorpay_payment_id: string,
  razorpay_order_id: string,
  amount: number,
  credits_added: number,
  package_name: string
) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          razorpay_payment_id,
          razorpay_order_id,
          amount: amount * 100, // Convert to paise
          currency: 'INR',
          credits_added,
          package_name,
          status: 'completed'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving transaction:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error in saveTransaction:', err);
    throw err;
  }
};

// Mark intro pack as purchased
export const markIntroPackPurchased = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ has_purchased_intro_pack: true })
      .eq('id', userId);

    if (error) {
      console.error('Error marking intro pack as purchased:', error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error('Error in markIntroPackPurchased:', err);
    throw err;
  }
};

// Get user transactions
export const getUserTransactions = async (userId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data.map(tx => ({
    id: tx.id,
    payment_id: tx.razorpay_payment_id,
    order_id: tx.razorpay_order_id,
    amount: tx.amount / 100, // Convert from paise to rupees
    currency: tx.currency,
    credits: tx.credits_added,
    package_name: tx.package_name,
    status: tx.status,
    date: tx.created_at
  }));
};

// --- Admin Functions ---

// Find user by email
export const findUserByEmail = async (email: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error finding user:', error);
    return null;
  }
  return data;
};

// Get all users (admin only)
export const getAllUsers = async (limit: number = 200) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, credits, is_admin, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data || [];
};

// Gift credits to user by userId (admin function)
export const giftCreditsToUser = async (userId: string, credits: number) => {
  const { data: user } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  const newBalance = user.credits + credits;
  const { error } = await supabase
    .from('profiles')
    .update({ credits: newBalance })
    .eq('id', userId);
  
  if (error) throw new Error(error.message);
  
  // Create notification for the user
  try {
    const notification = await createNotification(
      userId,
      'credit_gifted',
      'Credits Gifted',
      `You have received ${credits} credits as a gift from the admin.`,
      undefined,
      undefined,
      { credits_gifted: credits }
    );
    console.log('Gift notification created successfully:', notification);
  } catch (notifError: any) {
    // Don't fail the credit gifting if notification creation fails
    console.error('Error creating gift notification:', {
      error: notifError,
      message: notifError?.message,
      code: notifError?.code,
      details: notifError?.details,
      hint: notifError?.hint
    });
  }
  
  return newBalance;
};

// --- Support Tickets ---

// Create a support ticket with retry logic for race conditions
export const createSupportTicket = async (
  userId: string,
  subject: string,
  description: string,
  relatedImageUrls: string[],
  creditsUsed: number,
  attachmentUrls: string[] = [],
  relatedHistoryIds: string[] = [] // Array of generated_history IDs
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || session.user.id !== userId) {
    throw new Error('Unauthorized');
  }

  // Retry logic for handling race conditions
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add small random delay to reduce collision probability
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt + Math.random() * 100));
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: userId,
          ticket_number: null, // Explicitly null to trigger auto-generation by database trigger
          subject,
          description,
          related_image_urls: relatedImageUrls,
          related_history_ids: relatedHistoryIds.length > 0 ? relatedHistoryIds : null,
          credits_used: creditsUsed,
          attachment_urls: attachmentUrls,
          generation_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        // If it's a duplicate key error and we have retries left, try again
        if (error.code === '23505' && error.message?.includes('ticket_number') && attempt < maxRetries - 1) {
          console.warn(`Ticket number collision detected, retrying... (attempt ${attempt + 1}/${maxRetries})`);
          lastError = error;
          continue;
        }
        throw error;
      }

      return data;
    } catch (err: any) {
      lastError = err;
      // If it's not a duplicate key error or we're out of retries, throw immediately
      if (err.code !== '23505' || !err.message?.includes('ticket_number') || attempt === maxRetries - 1) {
        console.error('Error creating support ticket:', err);
        throw err;
      }
    }
  }

  // If we get here, all retries failed
  console.error('Failed to create support ticket after retries:', lastError);
  throw lastError;
};

// Get user's support tickets
export const getUserSupportTickets = async (userId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || session.user.id !== userId) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('Error fetching support tickets:', err);
    throw err;
  }
};

// Admin: Get all support tickets
export const getAllSupportTickets = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      throw new Error('Admin access required');
    }

    // Fetch tickets without join first
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Manually fetch user emails from profiles
    if (tickets && tickets.length > 0) {
      const userIds = [...new Set(tickets.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, credits')
        .in('id', userIds);

      // Map profiles to tickets
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return tickets.map(ticket => ({
        ...ticket,
        user: profileMap.get(ticket.user_id) || { email: 'N/A', credits: 0 }
      }));
    }

    return tickets || [];
  } catch (err: any) {
    console.error('Error fetching all support tickets:', err);
    throw err;
  }
};

// Admin: Update ticket status and process refund
export const updateSupportTicket = async (
  ticketId: string,
  status: 'pending' | 'in_review' | 'resolved' | 'rejected' | 'refunded',
  adminNotes?: string,
  creditsRefunded?: number
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      throw new Error('Admin access required');
    }

    // Get ticket to find user_id
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id, credits_used')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const updateData: any = {
      status,
      resolved_by: session.user.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    if (creditsRefunded && creditsRefunded > 0) {
      updateData.credits_refunded = creditsRefunded;
      
      // Refund credits to user
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', ticket.user_id)
        .single();
      
      if (userProfile) {
        const newBalance = userProfile.credits + creditsRefunded;
        await supabase
          .from('profiles')
          .update({ credits: newBalance })
          .eq('id', ticket.user_id);
      }
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Create notifications for the user
    try {
      // Get ticket number for notification
      const ticketNumber = data.ticket_number || `Ticket #${ticketId.substring(0, 8)}`;
      
      // If credits were refunded, create credit refund notification
      if (creditsRefunded && creditsRefunded > 0) {
        await createNotification(
          ticket.user_id,
          'credit_refund',
          'Credits Refunded',
          `Your support ticket ${ticketNumber} has been resolved and ${creditsRefunded} credits have been refunded to your account.`,
          ticketId,
          undefined,
          { credits_refunded: creditsRefunded }
        );
      }
      
      // Create ticket resolved notification
      await createNotification(
        ticket.user_id,
        'ticket_resolved',
        'Support Ticket Resolved',
        `Your support ticket ${ticketNumber} has been resolved.${adminNotes ? ' Admin notes: ' + adminNotes : ''}`,
        ticketId
      );
    } catch (notifError) {
      // Don't fail the ticket resolution if notification creation fails
      console.error('Error creating notifications:', notifError);
    }

    return data;
  } catch (err: any) {
    console.error('Error updating support ticket:', err);
    throw err;
  }
};

// Upload attachment to storage
export const uploadSupportAttachment = async (
  userId: string,
  file: File,
  ticketId: string
): Promise<string> => {
  try {
    const fileName = `${userId}/support/${ticketId}/${Date.now()}_${file.name}`;
    
    const { data, error } = await supabase.storage
      .from('generated-images') // Reuse existing bucket
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err: any) {
    console.error('Error uploading support attachment:', err);
    throw err;
  }
};

// --- Notifications ---

export interface Notification {
  id: string;
  user_id: string;
  type: 'credit_refund' | 'ticket_resolved' | 'ticket_updated' | 'credit_gifted' | 'system_announcement';
  title: string;
  message: string;
  is_read: boolean;
  related_ticket_id?: string;
  related_transaction_id?: string;
  metadata?: any;
  created_at: string;
}

// Create a notification
export const createNotification = async (
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  relatedTicketId?: string,
  relatedTransactionId?: string,
  metadata?: any
) => {
  try {
    // Get session to ensure we have proper auth context
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('No session when creating notification, proceeding anyway (may fail due to RLS)');
    }

    // Check if current user is admin (for better error messages)
    let isAdmin = false;
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();
      isAdmin = profile?.is_admin || false;
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_ticket_id: relatedTicketId,
        related_transaction_id: relatedTransactionId,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Notification insert error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId,
        type,
        currentUserId: session?.user?.id,
        isAdmin,
        rlsHint: isAdmin 
          ? 'Admin should be able to create notifications. Check RLS policy "Users and admins can create notifications".'
          : 'User can only create notifications for themselves. Check RLS policy.'
      });
      throw error;
    }
    
    console.log('Notification created successfully:', { id: data?.id, type, userId, createdBy: session?.user?.id });
    return data;
  } catch (err: any) {
    console.error('Error creating notification:', {
      error: err,
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      userId,
      type
    });
    throw err;
  }
};

// Get user's notifications
export const getUserNotifications = async (userId: string, limit: number = 50) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data as Notification[];
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || session.user.id !== userId) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
};

// Get history IDs that are already in ANY support ticket (to prevent duplicate complaints)
// This ensures each photo can only be in one ticket at a time
export const getHistoryIdsInTickets = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('related_history_ids')
      .eq('user_id', userId)
      .not('related_history_ids', 'is', null);
      // No status filter - check ALL tickets (pending, in_review, resolved, refunded)
      // This prevents the same photo from being in multiple tickets

    if (error) {
      console.error('Error fetching history IDs in tickets:', error);
      return [];
    }

    // Flatten the array of arrays and remove nulls
    const historyIdsInTickets = new Set<string>();
    data?.forEach(ticket => {
      if (ticket.related_history_ids && Array.isArray(ticket.related_history_ids)) {
        ticket.related_history_ids.forEach((id: string) => {
          if (id) historyIdsInTickets.add(id);
        });
      }
    });

    return Array.from(historyIdsInTickets);
  } catch (err) {
    console.error('Error getting history IDs in tickets:', err);
    return [];
  }
};

// Get refunded history IDs for a user (to filter out already refunded photos)
// Kept for backward compatibility if needed elsewhere
export const getRefundedHistoryIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('related_history_ids')
      .eq('user_id', userId)
      .in('status', ['resolved', 'refunded'])
      .gt('credits_refunded', 0)
      .not('related_history_ids', 'is', null);

    if (error) {
      console.error('Error fetching refunded history IDs:', error);
      return [];
    }

    // Flatten the array of arrays and remove nulls
    const refundedIds = new Set<string>();
    data?.forEach(ticket => {
      if (ticket.related_history_ids && Array.isArray(ticket.related_history_ids)) {
        ticket.related_history_ids.forEach((id: string) => {
          if (id) refundedIds.add(id);
        });
      }
    });

    return Array.from(refundedIds);
  } catch (err) {
    console.error('Error getting refunded history IDs:', err);
    return [];
  }
};
