import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { createSupportTicket, uploadSupportAttachment, getUserHistory, getHistoryIdsInTickets } from '../services/userService';

interface SupportModalProps {
  onClose: () => void;
  user: User | null;
  relatedImageUrls?: string[]; // Images from the lookbook
  creditsUsed?: number; // Credits used for generation
  relatedHistoryIds?: string[]; // IDs from generated_history table
  qualityMode?: 'fast' | 'quality'; // Quality mode for credit calculation
}

export const SupportModal: React.FC<SupportModalProps> = ({ 
  onClose, 
  user, 
  relatedImageUrls = [],
  creditsUsed = 0,
  relatedHistoryIds = [],
  qualityMode = 'fast'
}) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  
  // History images state
  const [historyImages, setHistoryImages] = useState<Array<{id: string, url: string, style: string, date: string}>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Track selected images - default to all images selected
  const [selectedImages, setSelectedImages] = useState<Set<string>>(
    new Set(relatedImageUrls)
  );
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // Fetch history when no related images are provided
  useEffect(() => {
    if (user && relatedImageUrls.length === 0) {
      setIsLoadingHistory(true);
      Promise.all([
        getUserHistory(user.id),
        getHistoryIdsInTickets(user.id)
      ])
        .then(([history, historyIdsInTickets]) => {
          // Filter out photos that are already in ANY support ticket
          // This ensures each photo can only be in one ticket at a time
          const filteredHistory = history.filter(item => 
            !item.id || !historyIdsInTickets.includes(item.id)
          );
          
          setHistoryImages(filteredHistory.map(item => ({
            id: item.id || '',
            url: item.url,
            style: item.style,
            date: item.date
          })));
        })
        .catch(err => {
          console.error('Error loading history:', err);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    }
  }, [user, relatedImageUrls.length]);

  // Update selected images when relatedImageUrls changes
  useEffect(() => {
    if (relatedImageUrls.length > 0) {
      setSelectedImages(new Set(relatedImageUrls));
    }
  }, [relatedImageUrls]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleImageSelection = (imageUrl: string, historyId?: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageUrl)) {
        newSet.delete(imageUrl);
        if (historyId) {
          setSelectedHistoryIds(prev => {
            const updated = new Set(prev);
            updated.delete(historyId);
            return updated;
          });
        }
      } else {
        newSet.add(imageUrl);
        if (historyId) {
          setSelectedHistoryIds(prev => new Set(prev).add(historyId));
        }
      }
      return newSet;
    });
  };

  const selectAllImages = () => {
    if (relatedImageUrls.length > 0) {
      setSelectedImages(new Set(relatedImageUrls));
    } else {
      // Select all history images
      const allHistoryUrls = new Set(historyImages.map(img => img.url));
      const allHistoryIds = new Set(historyImages.map(img => img.id));
      setSelectedImages(allHistoryUrls);
      setSelectedHistoryIds(allHistoryIds);
    }
  };

  const deselectAllImages = () => {
    setSelectedImages(new Set());
    setSelectedHistoryIds(new Set());
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

    if (selectedImages.size === 0) {
      setError('Please select at least one image to include in your complaint');
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

      // Get selected image URLs and their corresponding history IDs
      const selectedImageUrls = Array.from(selectedImages);
      const selectedHistoryIdsArray = relatedImageUrls.length > 0
        ? relatedHistoryIds.filter((_, idx) => 
            selectedImages.has(relatedImageUrls[idx])
          )
        : Array.from(selectedHistoryIds); // Use history IDs when no related images
      
      // Calculate credits used for selected images only (10 credits per image in fast mode, 20 in quality mode)
      const costPerImage = qualityMode === 'quality' ? 20 : 10;
      const selectedCreditsUsed = selectedImages.size * costPerImage;

      // Create ticket with only selected images
      const ticket = await createSupportTicket(
        user.id,
        subject,
        description,
        selectedImageUrls,
          selectedCreditsUsed,
          attachmentUrls,
          selectedHistoryIdsArray
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

            {/* Select Images to Include */}
            {(relatedImageUrls.length > 0 || historyImages.length > 0) && (
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-indigo-300 mb-1">
                      {relatedImageUrls.length > 0 ? 'Select Photos for Complaint' : 'Select Photos from History'}
                    </p>
                    <p className="text-xs text-indigo-400">
                      {selectedImages.size} of {relatedImageUrls.length > 0 ? relatedImageUrls.length : historyImages.length} selected
                      {selectedImages.size > 0 && ` • Credits: ${selectedImages.size * (qualityMode === 'quality' ? 20 : 10)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllImages}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Select All
                    </button>
                    <span className="text-indigo-600">|</span>
                    <button
                      type="button"
                      onClick={deselectAllImages}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                
                {/* Image Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 max-h-64 overflow-y-auto">
                  {isLoadingHistory ? (
                    <div className="col-span-full text-center text-zinc-400 py-4">
                      Loading history...
                    </div>
                  ) : relatedImageUrls.length > 0 ? (
                    // Show current generated images
                    relatedImageUrls.map((imageUrl, idx) => {
                      const isSelected = selectedImages.has(imageUrl);
                      return (
                        <div
                          key={idx}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group ${
                            isSelected
                              ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-105'
                              : 'border-zinc-700 hover:border-zinc-600 hover:scale-105'
                          }`}
                          onClick={() => toggleImageSelection(imageUrl)}
                        >
                          <img
                            src={imageUrl}
                            alt={`Generated photo ${idx + 1}`}
                            className="w-full h-28 sm:h-32 object-cover"
                          />
                          {/* Checkbox overlay */}
                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg ${
                            isSelected
                              ? 'bg-indigo-500'
                              : 'bg-zinc-800/90 group-hover:bg-zinc-700'
                          }`}>
                            {isSelected ? (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-3 h-3 rounded-full border-2 border-zinc-400" />
                            )}
                          </div>
                          {/* Dark overlay when not selected */}
                          {!isSelected && (
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-all" />
                          )}
                          {/* Image number badge */}
                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                            #{idx + 1}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Show history images
                    historyImages.map((historyItem, idx) => {
                      const isSelected = selectedImages.has(historyItem.url);
                      return (
                        <div
                          key={historyItem.id || idx}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group ${
                            isSelected
                              ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-105'
                              : 'border-zinc-700 hover:border-zinc-600 hover:scale-105'
                          }`}
                          onClick={() => toggleImageSelection(historyItem.url, historyItem.id)}
                        >
                          <img
                            src={historyItem.url}
                            alt={historyItem.style}
                            className="w-full h-28 sm:h-32 object-cover"
                          />
                          {/* Checkbox overlay */}
                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg ${
                            isSelected
                              ? 'bg-indigo-500'
                              : 'bg-zinc-800/90 group-hover:bg-zinc-700'
                          }`}>
                            {isSelected ? (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-3 h-3 rounded-full border-2 border-zinc-400" />
                            )}
                          </div>
                          {/* Dark overlay when not selected */}
                          {!isSelected && (
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-all" />
                          )}
                          {/* Style badge */}
                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded truncate max-w-[80%]">
                            {historyItem.style}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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

