import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AttendanceListResponse, AttendanceRecord, DeleteResponse, ErrorResponse, HealthStatus, MarkAttendanceRequest, RegisterUserRequest, RegisterUserResponse, UserDescriptorsResponse, UsersListResponse } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * Returns server health status
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Register a new user with webcam image and face descriptor
 */
export declare const getRegisterUserUrl: () => string;
export declare const registerUser: (registerUserRequest: RegisterUserRequest, options?: RequestInit) => Promise<RegisterUserResponse>;
export declare const getRegisterUserMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerUser>>, TError, {
        data: BodyType<RegisterUserRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof registerUser>>, TError, {
    data: BodyType<RegisterUserRequest>;
}, TContext>;
export type RegisterUserMutationResult = NonNullable<Awaited<ReturnType<typeof registerUser>>>;
export type RegisterUserMutationBody = BodyType<RegisterUserRequest>;
export type RegisterUserMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Register a new user with webcam image and face descriptor
 */
export declare const useRegisterUser: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerUser>>, TError, {
        data: BodyType<RegisterUserRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof registerUser>>, TError, {
    data: BodyType<RegisterUserRequest>;
}, TContext>;
/**
 * @summary Get all registered users with attendance statistics
 */
export declare const getGetUsersUrl: () => string;
export declare const getUsers: (options?: RequestInit) => Promise<UsersListResponse>;
export declare const getGetUsersQueryKey: () => readonly ["/api/users"];
export declare const getGetUsersQueryOptions: <TData = Awaited<ReturnType<typeof getUsers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUsers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getUsers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetUsersQueryResult = NonNullable<Awaited<ReturnType<typeof getUsers>>>;
export type GetUsersQueryError = ErrorType<unknown>;
/**
 * @summary Get all registered users with attendance statistics
 */
export declare function useGetUsers<TData = Awaited<ReturnType<typeof getUsers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUsers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get all users with their face descriptors for client-side matching
 */
export declare const getGetUserDescriptorsUrl: () => string;
export declare const getUserDescriptors: (options?: RequestInit) => Promise<UserDescriptorsResponse>;
export declare const getGetUserDescriptorsQueryKey: () => readonly ["/api/users/descriptors"];
export declare const getGetUserDescriptorsQueryOptions: <TData = Awaited<ReturnType<typeof getUserDescriptors>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUserDescriptors>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getUserDescriptors>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetUserDescriptorsQueryResult = NonNullable<Awaited<ReturnType<typeof getUserDescriptors>>>;
export type GetUserDescriptorsQueryError = ErrorType<unknown>;
/**
 * @summary Get all users with their face descriptors for client-side matching
 */
export declare function useGetUserDescriptors<TData = Awaited<ReturnType<typeof getUserDescriptors>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUserDescriptors>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Delete a user and their attendance records
 */
export declare const getDeleteUserUrl: (id: number) => string;
export declare const deleteUser: (id: number, options?: RequestInit) => Promise<DeleteResponse>;
export declare const getDeleteUserMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteUser>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteUser>>, TError, {
    id: number;
}, TContext>;
export type DeleteUserMutationResult = NonNullable<Awaited<ReturnType<typeof deleteUser>>>;
export type DeleteUserMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Delete a user and their attendance records
 */
export declare const useDeleteUser: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteUser>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteUser>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary Mark attendance for a user (auto check-in or check-out)
 */
export declare const getMarkAttendanceUrl: () => string;
export declare const markAttendance: (markAttendanceRequest: MarkAttendanceRequest, options?: RequestInit) => Promise<AttendanceRecord>;
export declare const getMarkAttendanceMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof markAttendance>>, TError, {
        data: BodyType<MarkAttendanceRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof markAttendance>>, TError, {
    data: BodyType<MarkAttendanceRequest>;
}, TContext>;
export type MarkAttendanceMutationResult = NonNullable<Awaited<ReturnType<typeof markAttendance>>>;
export type MarkAttendanceMutationBody = BodyType<MarkAttendanceRequest>;
export type MarkAttendanceMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Mark attendance for a user (auto check-in or check-out)
 */
export declare const useMarkAttendance: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof markAttendance>>, TError, {
        data: BodyType<MarkAttendanceRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof markAttendance>>, TError, {
    data: BodyType<MarkAttendanceRequest>;
}, TContext>;
/**
 * @summary Get all attendance records
 */
export declare const getGetAttendanceUrl: () => string;
export declare const getAttendance: (options?: RequestInit) => Promise<AttendanceListResponse>;
export declare const getGetAttendanceQueryKey: () => readonly ["/api/attendance"];
export declare const getGetAttendanceQueryOptions: <TData = Awaited<ReturnType<typeof getAttendance>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAttendance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAttendance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAttendanceQueryResult = NonNullable<Awaited<ReturnType<typeof getAttendance>>>;
export type GetAttendanceQueryError = ErrorType<unknown>;
/**
 * @summary Get all attendance records
 */
export declare function useGetAttendance<TData = Awaited<ReturnType<typeof getAttendance>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAttendance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map