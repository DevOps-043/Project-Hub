type BoundedIntegerOptions = {
  defaultValue: number;
  min?: number;
  max?: number;
};

type PaginationOptions = {
  defaultLimit: number;
  maxLimit: number;
  defaultPage?: number;
};

export function parseBoundedInteger(
  value: string | null,
  { defaultValue, min = 0, max }: BoundedIntegerOptions
): number {
  const parsed = Number.parseInt(value || '', 10);
  const safeValue = Number.isFinite(parsed) ? parsed : defaultValue;
  const lowerBounded = Math.max(min, safeValue);

  return max === undefined ? lowerBounded : Math.min(max, lowerBounded);
}

export function parsePagination(
  searchParams: URLSearchParams,
  { defaultLimit, maxLimit, defaultPage = 1 }: PaginationOptions
) {
  const page = parseBoundedInteger(searchParams.get('page'), {
    defaultValue: defaultPage,
    min: 1,
  });
  const limit = parseBoundedInteger(searchParams.get('limit'), {
    defaultValue: defaultLimit,
    min: 1,
    max: maxLimit,
  });
  const offset = parseBoundedInteger(searchParams.get('offset'), {
    defaultValue: (page - 1) * limit,
    min: 0,
  });

  return { page, limit, offset };
}
