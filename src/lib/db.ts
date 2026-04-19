export const supabase = {
  from: () => ({
    select: () => ({
      order: async () => ({ data: [], error: null }),
      eq: () => ({
        single: async () => ({ data: null, error: null })
      })
    }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null })
  })
};
