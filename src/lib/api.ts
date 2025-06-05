
// API route handler to proxy edge function calls
export const apiRoutes = {
  '/api/telegram/test-config': '/functions/v1/telegram-test-config',
  '/api/telegram/upload': '/functions/v1/telegram-upload',
};

// Helper function to make authenticated requests to edge functions
export const callEdgeFunction = async (functionName: string, data: any, options: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  return fetch(`/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options.headers,
    },
    body: typeof data === 'string' ? data : JSON.stringify(data),
    ...options,
  });
};
