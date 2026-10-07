import { apiSlice, providesList } from "./apiSlice";
import { notifyOnSettle } from "./notify";

export interface Project { id: number; name: string; user_count: number; is_system: boolean }
export const projectsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listProjects: builder.query<Project[], void>({
      query: () => ({ url: "/projects" }),
      providesTags: (result) => providesList("Projects", result),
    }),
    projectOptions: builder.query<Pick<Project, "id" | "name">[], void>({
      query: () => ({ url: "/projects/options" }),
      providesTags: [{ type: "Projects", id: "LIST" }],
    }),
    createProject: builder.mutation<Project, { name: string }>({
      query: (body) => ({ url: "/projects", method: "POST", body }),
      invalidatesTags: ["Projects"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) { await notifyOnSettle(dispatch, queryFulfilled); },
    }),
    updateProject: builder.mutation<Project, { id: number; name: string }>({
      query: ({ id, name }) => ({ url: `/projects/${id}`, method: "PATCH", body: { name } }),
      invalidatesTags: ["Projects", "Users", "LoginHours"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) { await notifyOnSettle(dispatch, queryFulfilled); },
    }),
    deleteProject: builder.mutation<Project, number>({
      query: (id) => ({ url: `/projects/${id}`, method: "DELETE" }),
      invalidatesTags: ["Projects"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) { await notifyOnSettle(dispatch, queryFulfilled); },
    }),
  }),
});
export const { useListProjectsQuery, useProjectOptionsQuery, useCreateProjectMutation, useUpdateProjectMutation, useDeleteProjectMutation } = projectsApi;
