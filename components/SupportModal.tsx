import React, { useState } from 'react';
import { User } from '../types';
import { createSupportTicket, uploadSupportAttachment } from '../services/userService';

interface SupportModalProps {
  onClose: () => void;
  user: User | null;
  relatedImageUrls?: string[]; // Images from the lookbook
  creditsUsed?: number; // Credits used for generation
}

export const SupportModal: React.FC<SupportModalProps> = ({ 
  onClose, 
  user, 
  relatedImageUrls = [],
  creditsUsed = 0 
}) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to submit a support ticket');
      return;
    }

    if (!subject.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload attachments first
      const attachmentUrls: string[] = [];
      const tempTicketId = `temp-${Date.now()}`;
      
      for (const file of attachments) {
        try {
          const url = await uploadSupportAttachment(user.id, file, tempTicketId);
          attachmentUrls.push(url);
        } catch (uploadError) {
          console.error('Failed to upload attachment:', uploadError);
          // Continue with other attachments even if one fails
        }
      }

      // Create ticket
      const ticket = await createSupportTicket(
        user.id,
        subject,
        description,
        relatedImageUrls,
        creditsUsed,
        attachmentUrls
      );

      setSuccess(true);
      setTicketNumber(ticket.ticket_number);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit support ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Ticket Submitted!</h2>
          <p className="text-zinc-400 mb-4">
            Your support ticket has been created successfully.
          </p>
          {ticketNumber && (
            <p className="text-indigo-400 font-mono text-sm mb-4">
              Ticket Number: {ticketNumber}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Our team will review your request and get back to you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-800 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition z-20 bg-zinc-800/80 hover:bg-zinc-700 rounded-full p-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 md:p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Contact Support</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Report an issue or request a refund for unsatisfactory results
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                placeholder="e.g., Poor quality images, Request refund"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Please describe the issue in detail..."
                required
              />
            </div>

            {/* Related Images Info */}
            {relatedImageUrls.length > 0 && (
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
                <p className="text-sm text-indigo-300 mb-2">
                  Related Generation: {relatedImageUrls.length} image(s) from your lookbook
                </p>
                {creditsUsed > 0 && (
                  <p className="text-xs text-indigo-400">
                    Credits used: {creditsUsed}
                  </p>
                )}
              </div>
            )}

            {/* Attachments */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Attach Photos (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
              />
              
              {attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-zinc-800 p-2 rounded">
                      <span className="text-sm text-zinc-300 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 py-3 rounded-xl font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    );
};

