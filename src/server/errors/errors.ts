/**
 * Custom Error Classes
 *
 * These classes help standardize error handling across the application.
 */

export enum HttpStatusCode {
  BAD_REQUEST = 400,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

export interface IHttpError {
  message: string;
  statusCode: HttpStatusCode;
}

export abstract class HttpError extends Error implements IHttpError {
  public statusCode: HttpStatusCode;

  constructor(message: string, statusCode: HttpStatusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 404
export class EntityNotFoundError extends HttpError {
  constructor(message?: string, id?: string) {
    super(
      message || `The requested entity ${id ?? "unknown"} could not be found.`,
      HttpStatusCode.NOT_FOUND,
    );
  }
}

// 400
export class MalformedBodyError extends HttpError {
  constructor(message?: string) {
    super(
      message || "The body of the request is malformed.",
      HttpStatusCode.BAD_REQUEST,
    );
  }
}

export class MalformedRequestError extends HttpError {
  constructor(message?: string) {
    super(
      message || "The request is malformed (missing parameter etc.).",
      HttpStatusCode.BAD_REQUEST,
    );
  }
}

// 422
export class DuplicateEntityError extends HttpError {
  constructor(message?: string, id?: string) {
    super(
      message ||
        `The entity ${id ?? "unknown"} already exists in the database.`,
      HttpStatusCode.UNPROCESSABLE_ENTITY,
    );
  }
}

export class InvalidBodyError extends HttpError {
  constructor(message?: string) {
    super(
      message ||
        "The body of the request is well formed, but could not be validated.",
      HttpStatusCode.UNPROCESSABLE_ENTITY,
    );
  }
}

// 403
export class CreatorDoesNotMatchError extends HttpError {
  constructor(message?: string) {
    super(
      message ||
        "Access to this resource is not allowed for you (but might be for other users).",
      HttpStatusCode.FORBIDDEN,
    );
  }
}

export class ForbiddenAccessError extends HttpError {
  constructor(message?: string) {
    super(message || "Access is forbidden.", HttpStatusCode.FORBIDDEN);
  }
}

// 500
export class BackendError extends HttpError {
  constructor(message?: string) {
    super(
      message || "There was an error with the backend. Please try again later.",
      HttpStatusCode.INTERNAL_SERVER_ERROR,
    );
  }
}

export class DatabaseAccessError extends BackendError {
  constructor(message?: string) {
    super(
      message ||
        "There was an error accessing the database. Please try again later.",
    );
  }
}

export class DatabaseInconsistencyError extends BackendError {
  constructor(message?: string) {
    super(
      message
        ? `${message} Please contact us at coli-conc@gbv.de or open an issue on GitHub. Thanks!`
        : "There was an inconsistency error with the database. Please try again later.",
    );
  }
}

export class ConfigurationError extends BackendError {
  constructor(message?: string) {
    super(
      message ||
        "There was an error with the server configuration. Please contact the server administrator and try again later.",
    );
  }
}

// Failing to ping to the solr instance
export class SolrPingError extends HttpError {
  constructor(message?: string) {
    super(
      message || "Failed to reach Solr instance (ping failed).",
      HttpStatusCode.SERVICE_UNAVAILABLE,
    );
  }
}
