export const supabase = {
  from: () => ({
    select: () => {
      const data = []
      const error = null

      const result = {
        data,
        error,
        order: () => result,
        eq: () => result,
        single: () => ({ data: null, error: null }),
        then: (resolve: any) => resolve({ data, error }),
      }

      return result
    },

    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
  })
}
