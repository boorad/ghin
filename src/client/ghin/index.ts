import { type Result, err, ok } from 'neverthrow'
import { z } from 'zod'
import { ConfigurationError, type GhinError, ValidationError, toGhinError } from '../../errors'
import { type ClientConfig, number, reportDegradation, schemaClientConfig } from '../../models'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import { CLIENT_SOURCE, RequestClient } from '../request-client'
import {
  type CourseCountriesResponse,
  type CourseCountry,
  type CourseDetailsRequest,
  type CourseDetailsResponse,
  type CourseHandicapGetRequest,
  type CourseHandicapsGetResponse,
  type CourseHandicapsRequest,
  type CoursePlayerHandicapsResponse,
  type CourseSearchRequest,
  type CourseSearchResponse,
  type EnsureRegisteredRequest,
  type EnsureRegisteredResult,
  type FacilitySearchRequest,
  type FacilitySearchResponse,
  type GolferCourseHandicapRequest,
  type GolfersGlobalSearchRequest,
  type GolfersSearchRequest,
  type GolfersSearchResponse,
  type GpaAccess,
  type GpaRequestAccessRequest,
  type GpaSuccessResponse,
  type GpaUpdateStatusRequest,
  type IterateUndeliveredRequest,
  type ScorePost18h9and9Request,
  type ScorePostAdjustedRequest,
  type ScorePostHbhRequest,
  type ScorePostResponse,
  type ScoresRequest,
  type ScoresResponse,
  type TeeSetRatingForScorePostingRequest,
  type TeeSetRatingRequest,
  type TeeSetRatingResponse,
  type TeeSetRatingsForScorePostingResponse,
  type UserAccessesResponse,
  type WebhookEnvelope,
  type WebhookEventType,
  type WebhookResendRequest,
  type WebhookSettings,
  type WebhookSettingsPatch,
  type WebhookSuccessResponse,
  type WebhooksListRequest,
  type WebhooksListResponse,
  schemaCourseCountriesResponse,
  schemaCourseDetailsRequest,
  schemaCourseDetailsResponse,
  schemaCourseHandicapGetRequest,
  schemaCourseHandicapsGetResponse,
  schemaCoursePlayerHandicapsResponse,
  schemaCourseSearchRequest,
  schemaCourseSearchResponse,
  schemaEnsureRegisteredRequest,
  schemaFacilitySearchRequest,
  schemaFacilitySearchResponse,
  schemaGolferCourseHandicapRequest,
  schemaGolfersGlobalSearchRequest,
  schemaGolfersSearchRequest,
  schemaGolfersSearchResponse,
  schemaGpaRequestAccessRequest,
  schemaGpaSuccessResponse,
  schemaGpaUpdateStatusRequest,
  schemaIterateUndeliveredRequest,
  schemaScorePost18h9and9Request,
  schemaScorePostAdjustedRequest,
  schemaScorePostHbhRequest,
  schemaScorePostResponse,
  schemaScoresRequest,
  schemaScoresResponse,
  schemaTeeSetRatingForScorePostingRequest,
  schemaTeeSetRatingRequest,
  schemaTeeSetRatingResponse,
  schemaTeeSetRatingsForScorePostingResponse,
  schemaUserAccessesResponse,
  schemaWebhookEventType,
  schemaWebhookResendRequest,
  schemaWebhookSettings,
  schemaWebhookSettingsPatch,
  schemaWebhookSuccessResponse,
  schemaWebhooksListRequest,
  schemaWebhooksListResponse,
} from './models'

const searchParameters = {
  GOLFER_ID: 'golfer_id',
  SOURCE: 'source',
} as const

export class GhinClient {
  private httpClient: RequestClient

  courses: {
    getCountries: () => Promise<Result<CourseCountry[], GhinError>>
    getDetails: (request: CourseDetailsRequest) => Promise<Result<CourseDetailsResponse, GhinError>>
    search: (request: CourseSearchRequest) => Promise<Result<CourseSearchResponse, GhinError>>
    getTeeSetRating: (request: TeeSetRatingRequest) => Promise<Result<TeeSetRatingResponse, GhinError>>
    getTeeSetRatingsForScorePosting: (
      request: TeeSetRatingForScorePostingRequest,
    ) => Promise<Result<TeeSetRatingsForScorePostingResponse, GhinError>>
  }

  facilities: {
    search: (request: FacilitySearchRequest) => Promise<Result<FacilitySearchResponse, GhinError>>
  }

  golfers: {
    getOne: (ghinNumber: number) => Promise<Result<GolfersSearchResponse['golfers'][number] | undefined, GhinError>>
    getScores: (ghinNumber: number, request?: ScoresRequest) => Promise<Result<ScoresResponse, GhinError>>
    search: (request: GolfersSearchRequest) => Promise<Result<GolfersSearchResponse['golfers'], GhinError>>
    globalSearch: (request: GolfersGlobalSearchRequest) => Promise<Result<GolfersSearchResponse['golfers'], GhinError>>
  }

  gpa: {
    getAccesses: () => Promise<Result<GpaAccess[], GhinError>>
    requestAccess: (
      golferId: number,
      request: GpaRequestAccessRequest,
    ) => Promise<Result<GpaSuccessResponse, GhinError>>
    updateStatus: (request: GpaUpdateStatusRequest) => Promise<Result<GpaSuccessResponse, GhinError>>
    revokeAccess: (golferId: number) => Promise<Result<GpaSuccessResponse, GhinError>>
  }

  handicaps: {
    getOne: (ghinNumber: number) => Promise<Result<GolfersSearchResponse['golfers'][number] | undefined, GhinError>>
    getCoursePlayerHandicaps: (
      requests: GolferCourseHandicapRequest[],
    ) => Promise<Result<CoursePlayerHandicapsResponse, GhinError>>
    getCourseHandicaps: (request: CourseHandicapGetRequest) => Promise<Result<CourseHandicapsGetResponse, GhinError>>
  }

  scores: {
    postHoleByHole: (request: ScorePostHbhRequest) => Promise<Result<ScorePostResponse, GhinError>>
    postAdjusted: (request: ScorePostAdjustedRequest) => Promise<Result<ScorePostResponse, GhinError>>
    post18h9and9: (request: ScorePost18h9and9Request) => Promise<Result<ScorePostResponse, GhinError>>
  }

  webhooks: {
    get: () => Promise<Result<WebhookSettings, GhinError>>
    patch: (settings: WebhookSettingsPatch) => Promise<Result<WebhookSettings, GhinError>>
    delete: () => Promise<Result<WebhookSuccessResponse, GhinError>>
    test: (type: WebhookEventType) => Promise<Result<WebhookSuccessResponse, GhinError>>
    list: (request?: WebhooksListRequest) => Promise<Result<WebhooksListResponse, GhinError>>
    resend: (request: WebhookResendRequest) => Promise<Result<WebhookSuccessResponse, GhinError>>
    ensureRegistered: (request: EnsureRegisteredRequest) => Promise<Result<EnsureRegisteredResult, GhinError>>
    /**
     * Yields one `Result` per envelope and never throws or rejects — a failure
     * arrives as a yielded `err`, so a recovery worker can decide whether to
     * carry on. See {@link GhinClient.webhooksIterateUndelivered}.
     */
    iterateUndelivered: (
      request?: IterateUndeliveredRequest,
    ) => AsyncGenerator<Result<WebhookEnvelope, GhinError>, void, void>
  }

  /** Caller's degradation reporter — see {@link ClientConfig.onDegraded}. */
  private readonly onDegraded: ClientConfig['onDegraded']

  constructor(config: ClientConfig) {
    const results = schemaClientConfig.safeParse(config)

    if (!results.success) {
      throw new ConfigurationError(`Invalid GhinClientConfig: ${results.error.message}`)
    }

    this.onDegraded = results.data.onDegraded

    this.httpClient = new RequestClient({
      ...results.data,
      cache: results.data.cache ?? new InMemoryCacheClient(),
    })

    this.courses = {
      getCountries: this.coursesGetCountries.bind(this),
      getDetails: this.courseGetDetails.bind(this),
      search: this.courseSearch.bind(this),
      getTeeSetRating: this.courseGetTeeSetRating.bind(this),
      getTeeSetRatingsForScorePosting: this.courseGetTeeSetRatingsForScorePosting.bind(this),
    }

    this.facilities = {
      search: this.facilitySearch.bind(this),
    }

    this.gpa = {
      getAccesses: this.gpaGetAccesses.bind(this),
      requestAccess: this.gpaRequestAccess.bind(this),
      updateStatus: this.gpaUpdateStatus.bind(this),
      revokeAccess: this.gpaRevokeAccess.bind(this),
    }

    this.handicaps = {
      getOne: this.handicapsGetOne.bind(this),
      getCoursePlayerHandicaps: this.handicapsGetCoursePlayerHandicaps.bind(this),
      getCourseHandicaps: this.handicapsGetCourseHandicaps.bind(this),
    }

    this.golfers = {
      getOne: this.golfersGetOne.bind(this),
      getScores: this.golfersGetScores.bind(this),
      search: this.golfersSearch.bind(this),
      globalSearch: this.golfersGlobalSearch.bind(this),
    }

    this.scores = {
      postHoleByHole: this.scoresPostHoleByHole.bind(this),
      postAdjusted: this.scoresPostAdjusted.bind(this),
      post18h9and9: this.scoresPost18h9and9.bind(this),
    }

    this.webhooks = {
      get: this.webhooksGet.bind(this),
      patch: this.webhooksPatch.bind(this),
      delete: this.webhooksDelete.bind(this),
      test: this.webhooksTest.bind(this),
      list: this.webhooksList.bind(this),
      resend: this.webhooksResend.bind(this),
      ensureRegistered: this.webhooksEnsureRegistered.bind(this),
      iterateUndelivered: this.webhooksIterateUndelivered.bind(this),
    }
  }

  // ── Courses ──────────────────────────────────────────────────────────

  private async coursesGetCountries(): Promise<Result<CourseCountry[], GhinError>> {
    try {
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])
      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<CourseCountriesResponse>({
        entity: 'course_countries',
        options,
        schema: schemaCourseCountriesResponse,
      })

      return result.map((response) => response.countries)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async courseGetDetails(request: CourseDetailsRequest): Promise<Result<CourseDetailsResponse, GhinError>> {
    try {
      const parsedRequest = schemaCourseDetailsRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid course details request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      for (const [key, value] of Object.entries(validRequest)) {
        searchParams.set(key, value.toString())
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<CourseDetailsResponse>({
        entity: 'course_details',
        options,
        schema: schemaCourseDetailsResponse,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      const { invalidTeeSets, ...details } = result.value
      reportDegradation(
        this.onDegraded,
        'course_details',
        invalidTeeSets,
        details.TeeSets.length + invalidTeeSets.length,
      )

      return ok({ ...details, invalidTeeSets })
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async courseGetTeeSetRating(request: TeeSetRatingRequest): Promise<Result<TeeSetRatingResponse, GhinError>> {
    try {
      const parsedRequest = schemaTeeSetRatingRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid tee set rating request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      if (validRequest.include_altered_tees !== undefined) {
        searchParams.set('include_altered_tees', validRequest.include_altered_tees.toString())
      }

      const path = `/TeeSetRatings/${validRequest.tee_set_rating_id}.json`

      const options: Parameters<typeof this.httpClient.fetchCustomPath>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetchCustomPath<TeeSetRatingResponse>({
        path,
        options,
        schema: schemaTeeSetRatingResponse,
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async courseGetTeeSetRatingsForScorePosting(
    request: TeeSetRatingForScorePostingRequest,
  ): Promise<Result<TeeSetRatingsForScorePostingResponse, GhinError>> {
    try {
      const parsedRequest = schemaTeeSetRatingForScorePostingRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(
          new ValidationError(`Invalid tee set rating for score posting request: ${parsedRequest.error.message}`),
        )
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      const path = `/Courses/${validRequest.course_id}/TeeSetRatingsForScorePosting.json`

      const options: Parameters<typeof this.httpClient.fetchCustomPath>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetchCustomPath<TeeSetRatingsForScorePostingResponse>({
        path,
        options,
        schema: schemaTeeSetRatingsForScorePostingResponse,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      reportDegradation(
        this.onDegraded,
        'tee_set_ratings_for_score_posting',
        result.value.invalid,
        result.value.tee_set_ratings.length + result.value.invalid.length,
      )

      return ok(result.value)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async courseSearch(request: CourseSearchRequest): Promise<Result<CourseSearchResponse, GhinError>> {
    try {
      const parsedRequest = schemaCourseSearchRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid course search request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      for (const [key, value] of Object.entries(validRequest)) {
        searchParams.set(key, value.toString())
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<CourseSearchResponse>({
        entity: 'course_search',
        options,
        schema: schemaCourseSearchResponse,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      reportDegradation(
        this.onDegraded,
        'course_search',
        result.value.invalid,
        result.value.courses.length + result.value.invalid.length,
      )

      return ok(result.value)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // ── Facilities ───────────────────────────────────────────────────────

  private async facilitySearch(request: FacilitySearchRequest): Promise<Result<FacilitySearchResponse, GhinError>> {
    try {
      const parsedRequest = schemaFacilitySearchRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid facility search request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      for (const [key, value] of Object.entries(validRequest)) {
        searchParams.set(key, value.toString())
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<FacilitySearchResponse>({
        entity: 'facility_search',
        options,
        schema: schemaFacilitySearchResponse,
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // ── GPA (Golfer Product Access) ──────────────────────────────────────

  // The endpoint is USGA's "UserAccesses" (not GPA-specific) and returns
  // federations/associations/clubs alongside golfers. Flatten the `golfers`
  // branch — the only one that carries GPA state — into a clean array so
  // callers don't have to deal with the unrelated outer fields.
  private async gpaGetAccesses(): Promise<Result<GpaAccess[], GhinError>> {
    try {
      const result = await this.httpClient.fetch<UserAccessesResponse>({
        entity: 'gpa_accesses',
        schema: schemaUserAccessesResponse,
      })

      return result.map((response) =>
        response.golfers.map((entry) => ({
          golferId: entry.golfer.id,
          userAccessId: entry.user_access.id,
          golferName: entry.user_access.golfer_name,
          gpaStatus: entry.user_access.gpa_status,
        })),
      )
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // USGA requires an `email` in the POST body; without it the endpoint
  // returns 400 `{ errors: { email: ["can't be blank"] } }`. The on-file
  // golfer email is the safe choice; whether USGA validates it against
  // their records or accepts any string is unconfirmed.
  private async gpaRequestAccess(
    golferId: number,
    request: GpaRequestAccessRequest,
  ): Promise<Result<GpaSuccessResponse, GhinError>> {
    try {
      // Both parses shared one catch, so both reported the same message.
      // Kept in the original order (id, then body) so the wording is unchanged.
      const parsedId = number.positive().safeParse(golferId)

      if (!parsedId.success) {
        return err(new ValidationError(`Invalid GPA request access request: ${parsedId.error.message}`))
      }

      const parsedRequest = schemaGpaRequestAccessRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid GPA request access request: ${parsedRequest.error.message}`))
      }

      const id = parsedId.data
      const { email } = parsedRequest.data

      const path = `/users/golfers/${id}/request_golfer_product_access.json`

      const result = await this.httpClient.fetchCustomPath<GpaSuccessResponse>({
        path,
        schema: schemaGpaSuccessResponse,
        options: {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // `user_id` here is the **credentialed admin user's** `user.id` from
  // `POST /users/login.json` — *not* the golfer's user and *not* the
  // `userAccessId` returned by `getAccesses()`. Easy to confuse; the URL
  // accepts all three numerically but only the admin id is authorized.
  private async gpaUpdateStatus(request: GpaUpdateStatusRequest): Promise<Result<GpaSuccessResponse, GhinError>> {
    try {
      const parsedRequest = schemaGpaUpdateStatusRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid GPA update status request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data

      const path = `/users/${validRequest.user_id}/golfers/${validRequest.golfer_id}/update_golfer_product_access_status.json`

      const result = await this.httpClient.fetchCustomPath<GpaSuccessResponse>({
        path,
        schema: schemaGpaSuccessResponse,
        options: {
          method: 'POST',
          body: JSON.stringify({ gpa_status: validRequest.status }),
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // Revoke marks the underlying `user_access` record `inactive`; it does
  // not delete it. Re-firing `requestAccess` against the same golfer
  // reuses that record and flips status back to `pending`.
  private async gpaRevokeAccess(golferId: number): Promise<Result<GpaSuccessResponse, GhinError>> {
    try {
      const parsedId = number.positive().safeParse(golferId)

      if (!parsedId.success) {
        return err(new ValidationError(`Invalid golfer ID: ${parsedId.error.message}`))
      }

      const path = `/users/golfers/${parsedId.data}/revoke_golfer_product_access.json`

      const result = await this.httpClient.fetchCustomPath<GpaSuccessResponse>({
        path,
        schema: schemaGpaSuccessResponse,
        options: {
          method: 'DELETE',
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // ── Handicaps ────────────────────────────────────────────────────────

  // Backed by `GET /golfers/search.json`, not the `/search_golfer.json` this used
  // to call: that path 404s on every staging golfer and every parameter variant
  // (#68), so this method has never returned a value. `/golfers/search.json` is
  // where the handicap index actually lives — `handicap_index`, `hi_display`,
  // `low_hi*`, `hard_cap` and `soft_cap` are all on the golfer record.
  //
  // It therefore returns the whole golfer record, exactly as `golfers.getOne`
  // does, rather than a hand-picked "handicap fields only" projection. A
  // projection would be a key list to maintain against an API that adds fields
  // without warning, and `schemaGolfer` is `.passthrough()` (#70) — narrowing
  // here would silently drop the very keys that passthrough exists to preserve.
  // The endpoint has no `clubs`, so the old response's `clubs` array is gone.
  //
  // ACTIVE GOLFERS ONLY. This delegates to `golfersGetOne`, which searches with
  // `status: 'Active'` (the same default `golfersSearch` applies), and there is
  // no parameter here to opt out of it. A lapsed or inactive member has a real,
  // readable Handicap Index and this method still resolves `undefined` for them
  // — no error, and indistinguishable from "no such GHIN number". Callers who
  // need those golfers should use `golfers.search({ golfer_id, status })` with
  // `'Inactive'` or `'All'`. Parameterizing this is a separate design decision.
  //
  // The lookup is a golfer search underneath, so a row that fails `schemaGolfer`
  // is reported to `onDegraded` under entity `golfers_search`, not a handicaps
  // entity — an `undefined` from a dropped row reads as a search in that log.
  private async handicapsGetOne(
    ghinNumber: number,
  ): Promise<Result<GolfersSearchResponse['golfers'][number] | undefined, GhinError>> {
    return this.golfersGetOne(ghinNumber)
  }

  // The single entry point for `POST /playing_handicaps.json`; the duplicate
  // `getPlayingHandicaps` sent a request shape the API rejects and was removed in #62.
  private async handicapsGetCoursePlayerHandicaps(
    request: GolferCourseHandicapRequest[],
  ): Promise<Result<CoursePlayerHandicapsResponse, GhinError>> {
    try {
      const parsedRequest = z.array(schemaGolferCourseHandicapRequest).safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid course handicap request: ${parsedRequest.error.message}`))
      }

      const golfers = parsedRequest.data.map(({ ghin, ...golfer }) => ({
        ...golfer,
        [searchParameters.GOLFER_ID]: ghin,
      }))

      const searchParams = new URLSearchParams()

      const courseHandicapRequest: CourseHandicapsRequest = {
        golfers,
        source: CLIENT_SOURCE,
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        body: JSON.stringify(courseHandicapRequest),
        method: 'POST',
        searchParams,
      }

      const result = await this.httpClient.fetch<CoursePlayerHandicapsResponse>({
        entity: 'course_handicaps',
        options,
        schema: schemaCoursePlayerHandicapsResponse,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      // One report per dropped golfer, not per dropped bucket: `invalid` is
      // already deduplicated by `golfer_id`, and every percentage bucket carries
      // the same golfer set, so `total` counts the golfers GHIN sent rather than
      // twenty times that.
      const { invalid, ...percentages } = result.value
      const golferIds = new Set(Object.values(percentages).flatMap((bucket) => Object.keys(bucket)))

      reportDegradation(this.onDegraded, 'course_handicaps', invalid, golferIds.size + invalid.length)

      return ok(result.value)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async handicapsGetCourseHandicaps(
    request: CourseHandicapGetRequest,
  ): Promise<Result<CourseHandicapsGetResponse, GhinError>> {
    try {
      const parsedRequest = schemaCourseHandicapGetRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid course handicap request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      for (const [key, value] of Object.entries(validRequest)) {
        searchParams.set(key, value.toString())
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<CourseHandicapsGetResponse>({
        entity: 'course_handicaps_get',
        options,
        schema: schemaCourseHandicapsGetResponse,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      reportDegradation(
        this.onDegraded,
        'course_handicaps_get',
        result.value.invalid,
        result.value.tee_sets.length + result.value.invalid.length,
      )

      return ok(result.value)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // ── Golfers ──────────────────────────────────────────────────────────

  private async golfersSearch(
    request: GolfersSearchRequest,
  ): Promise<Result<GolfersSearchResponse['golfers'], GhinError>> {
    try {
      const parsedRequest = schemaGolfersSearchRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid golfer search request: ${parsedRequest.error.message}`))
      }

      const params = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      const searchDefaults = {
        page: 1,
        per_page: 25,
        sorting_criteria: 'last_name_first_name',
        status: 'Active',
        order: 'asc',
      }

      for (const [key, value] of Object.entries(searchDefaults)) {
        searchParams.set(key, value.toString())
      }

      for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, value?.toString() ?? '')
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<GolfersSearchResponse>({
        entity: 'golfers_search',
        schema: schemaGolfersSearchResponse,
        options,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      reportDegradation(
        this.onDegraded,
        'golfers_search',
        result.value.invalid,
        result.value.golfers.length + result.value.invalid.length,
      )

      return ok(result.value.golfers)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async golfersGlobalSearch(
    request: GolfersGlobalSearchRequest,
  ): Promise<Result<GolfersSearchResponse['golfers'], GhinError>> {
    try {
      const parsedRequest = schemaGolfersGlobalSearchRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid golfer search request: ${parsedRequest.error.message}`))
      }

      const { ghin, ...rest } = parsedRequest.data
      const searchParams = new URLSearchParams([['source', CLIENT_SOURCE]])

      const searchDefaults = {
        from_ghin: true,
        per_page: 25,
        sorting_criteria: 'full_name',
        order: 'asc',
        page: 1,
      }

      for (const [key, value] of Object.entries(searchDefaults)) {
        searchParams.set(key, value.toString())
      }

      for (const [key, value] of Object.entries(rest)) {
        searchParams.set(key, value?.toString() ?? '')
      }

      if (ghin) {
        searchParams.set(searchParameters.GOLFER_ID, ghin.toString())
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<GolfersSearchResponse>({
        entity: 'golfers_global_search',
        schema: schemaGolfersSearchResponse,
        options,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      reportDegradation(
        this.onDegraded,
        'golfers_global_search',
        result.value.invalid,
        result.value.golfers.length + result.value.invalid.length,
      )

      return ok(result.value.golfers)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // "No such active golfer" is an `Ok(undefined)`, not an `Err`: an empty search
  // result is a normal answer from GHIN, not a failed request. Only a transport,
  // auth or validation failure produces an `Err` here.
  private async golfersGetOne(
    ghinNumber: number,
  ): Promise<Result<GolfersSearchResponse['golfers'][number] | undefined, GhinError>> {
    try {
      const parsedGhin = number.safeParse(ghinNumber)

      if (!parsedGhin.success) {
        return err(new ValidationError(`Invalid GHIN number: ${parsedGhin.error.message}`))
      }

      const results = await this.golfersSearch({
        golfer_id: parsedGhin.data,
        page: 1,
        per_page: 1,
        status: 'Active',
      })

      return results.map((golfers) => golfers[0])
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async golfersGetScores(
    ghinNumber: number,
    request?: ScoresRequest,
  ): Promise<Result<ScoresResponse, GhinError>> {
    try {
      const parsedRequest = schemaScoresRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid scores request: ${parsedRequest.error.message}`))
      }

      const parsedGhin = number.safeParse(ghinNumber)

      if (!parsedGhin.success) {
        return err(new ValidationError(`Invalid scores request: ${parsedGhin.error.message}`))
      }

      const validRequest = parsedRequest.data ?? {}
      const ghin = parsedGhin.data

      const searchParams = new URLSearchParams([
        [searchParameters.GOLFER_ID, ghin.toString()],
        ['source', CLIENT_SOURCE],
      ])

      for (const [key, value] of Object.entries(validRequest)) {
        if (value === null) {
          continue
        }

        if (Array.isArray(value)) {
          for (const v of value) {
            searchParams.append(key, v.toString())
          }
          continue
        }

        if (typeof value === 'object' && value instanceof Date) {
          searchParams.set(key, value.toISOString().split('T')[0] as string)
          continue
        }

        searchParams.set(key, value.toString())
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<ScoresResponse>({
        entity: 'scores',
        options,
        schema: schemaScoresResponse,
      })

      if (result.isErr()) {
        return err(result.error)
      }

      reportDegradation(
        this.onDegraded,
        'scores',
        result.value.invalid,
        result.value.scores.length + result.value.invalid.length,
      )

      return ok(result.value)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // ── Score Posting ────────────────────────────────────────────────────

  private async scoresPostHoleByHole(request: ScorePostHbhRequest): Promise<Result<ScorePostResponse, GhinError>> {
    try {
      const parsedRequest = schemaScorePostHbhRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid hole-by-hole score request: ${parsedRequest.error.message}`))
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(parsedRequest.data),
      }

      const result = await this.httpClient.fetch<{ score: ScorePostResponse }>({
        entity: 'scores_hbh',
        options,
        schema: schemaScorePostResponse,
      })

      return result.map((response) => response.score)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async scoresPostAdjusted(request: ScorePostAdjustedRequest): Promise<Result<ScorePostResponse, GhinError>> {
    try {
      const parsedRequest = schemaScorePostAdjustedRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid adjusted score request: ${parsedRequest.error.message}`))
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(parsedRequest.data),
      }

      const result = await this.httpClient.fetch<{ score: ScorePostResponse }>({
        entity: 'scores_adjusted',
        options,
        schema: schemaScorePostResponse,
      })

      return result.map((response) => response.score)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async scoresPost18h9and9(request: ScorePost18h9and9Request): Promise<Result<ScorePostResponse, GhinError>> {
    try {
      const parsedRequest = schemaScorePost18h9and9Request.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid 18h 9-and-9 score request: ${parsedRequest.error.message}`))
      }

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(parsedRequest.data),
      }

      const result = await this.httpClient.fetch<{ score: ScorePostResponse }>({
        entity: 'scores_18h9and9',
        options,
        schema: schemaScorePostResponse,
      })

      return result.map((response) => response.score)
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // ── Webhooks ─────────────────────────────────────────────────────────

  private async webhooksGet(): Promise<Result<WebhookSettings, GhinError>> {
    try {
      const result = await this.httpClient.fetchCustomPath<WebhookSettings>({
        path: '/user/webhook_settings.json',
        schema: schemaWebhookSettings,
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async webhooksPatch(settings: WebhookSettingsPatch): Promise<Result<WebhookSettings, GhinError>> {
    try {
      const parsedRequest = schemaWebhookSettingsPatch.safeParse(settings)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid webhook settings patch: ${parsedRequest.error.message}`))
      }

      const result = await this.httpClient.fetchCustomPath<WebhookSettings>({
        path: '/user/webhook_settings.json',
        schema: schemaWebhookSettings,
        options: {
          method: 'PATCH',
          body: JSON.stringify(parsedRequest.data),
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async webhooksDelete(): Promise<Result<WebhookSuccessResponse, GhinError>> {
    try {
      const result = await this.httpClient.fetchCustomPath<WebhookSuccessResponse>({
        path: '/user/webhook_settings.json',
        schema: schemaWebhookSuccessResponse,
        options: {
          method: 'DELETE',
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async webhooksTest(type: WebhookEventType): Promise<Result<WebhookSuccessResponse, GhinError>> {
    try {
      const parsedType = schemaWebhookEventType.safeParse(type)

      if (!parsedType.success) {
        return err(new ValidationError(`Invalid webhook event type: ${parsedType.error.message}`))
      }

      const searchParams = new URLSearchParams([['type', parsedType.data]])

      const result = await this.httpClient.fetchCustomPath<WebhookSuccessResponse>({
        path: '/user/webhook_settings/test.json',
        schema: schemaWebhookSuccessResponse,
        options: {
          searchParams,
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async webhooksList(request: WebhooksListRequest = {}): Promise<Result<WebhooksListResponse, GhinError>> {
    try {
      const parsedRequest = schemaWebhooksListRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid webhooks list request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams()

      for (const [key, value] of Object.entries(validRequest)) {
        if (value === undefined || value === null) {
          continue
        }
        searchParams.set(key, value.toString())
      }

      const result = await this.httpClient.fetchCustomPath<WebhooksListResponse>({
        path: '/user/webhooks.json',
        schema: schemaWebhooksListResponse,
        options: {
          searchParams,
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  private async webhooksResend(request: WebhookResendRequest): Promise<Result<WebhookSuccessResponse, GhinError>> {
    try {
      const parsedRequest = schemaWebhookResendRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid webhook resend request: ${parsedRequest.error.message}`))
      }

      const validRequest = parsedRequest.data
      const searchParams = new URLSearchParams([
        ['webhook_id', validRequest.webhook_id.toString()],
        ['is_crs_webhook', validRequest.is_crs_webhook.toString()],
      ])

      const result = await this.httpClient.fetchCustomPath<WebhookSuccessResponse>({
        path: '/user/resend_webhook.json',
        schema: schemaWebhookSuccessResponse,
        options: {
          method: 'POST',
          searchParams,
        },
      })

      return result
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // Idempotent registration: GET current settings, PATCH only if the leaf for
  // the given event differs. PATCH upstream is itself idempotent, so a
  // spurious update round-trips harmlessly; the GET-first dance just avoids
  // the side-effect when nothing has changed.
  private async webhooksEnsureRegistered(
    request: EnsureRegisteredRequest,
  ): Promise<Result<EnsureRegisteredResult, GhinError>> {
    try {
      const parsedRequest = schemaEnsureRegisteredRequest.safeParse(request)

      if (!parsedRequest.success) {
        return err(new ValidationError(`Invalid ensureRegistered request: ${parsedRequest.error.message}`))
      }

      const { event, url, dataType, enabled } = parsedRequest.data

      // A failed GET short-circuits: no PATCH is attempted, and the inner
      // error instance is handed back untouched.
      const currentResult = await this.webhooksGet()

      if (currentResult.isErr()) {
        return err(currentResult.error)
      }

      const current = currentResult.value

      const currentUrl = current.webhook_url[event]
      const currentDataType = current.webhook_data_type[event]
      const currentEnabled = current.webhook_enabled[event]

      const reasons: string[] = []
      if (normalizeWebhookUrl(currentUrl) !== normalizeWebhookUrl(url)) {
        reasons.push(`url differs (got ${describeLeaf(currentUrl)})`)
      }
      if (currentDataType !== dataType) {
        reasons.push(`data_type differs (got ${describeLeaf(currentDataType)}, want ${dataType})`)
      }
      if (currentEnabled !== enabled) {
        reasons.push(`enabled differs (got ${describeLeaf(currentEnabled)}, want ${enabled})`)
      }

      if (reasons.length === 0) {
        return ok({ changed: false, settings: current })
      }

      const patchResult = await this.webhooksPatch({
        webhook_url: { [event]: url },
        webhook_data_type: { [event]: dataType },
        webhook_enabled: { [event]: enabled },
      })

      return patchResult.map((settings) => ({ changed: true, reason: reasons.join('; '), settings }))
    } catch (error) {
      return err(toGhinError(error))
    }
  }

  // Pages through `status=not sent` deliveries and yields each envelope.
  // Stops when a page returns fewer than `per_page` results, so the caller
  // doesn't have to track pagination state. Filter by object_type/from_date
  // to bound the scan window in a recovery worker.
  /**
   * Never throws and never rejects: every failure is a yielded `err`, so a
   * missed-delivery recovery worker can log one and keep its own loop alive
   * instead of unwinding mid-scan.
   *
   * All three failure modes are terminal — the generator yields the `err` and
   * returns. Bad input means there is nothing to page through; a failed page
   * fetch means there are no further pages to read; and the page cap only
   * fires when the filters are too broad to finish. Envelopes themselves are
   * validated a page at a time by `schemaWebhooksListResponse`, so today an
   * `err` is always page-shaped; the per-envelope `Result` leaves room for
   * per-row recovery without another breaking change.
   */
  private async *webhooksIterateUndelivered(
    request: IterateUndeliveredRequest = {},
  ): AsyncGenerator<Result<WebhookEnvelope, GhinError>, void, void> {
    const parsedRequest = schemaIterateUndeliveredRequest.safeParse(request)

    if (!parsedRequest.success) {
      yield err(new ValidationError(`Invalid iterateUndelivered request: ${parsedRequest.error.message}`))
      return
    }

    const { per_page, object_type, from_date, to_date } = parsedRequest.data

    let page = 1
    while (true) {
      const result = await this.webhooksList({
        page,
        per_page,
        status: 'not sent',
        ...(object_type !== undefined ? { object_type } : {}),
        ...(from_date !== undefined ? { from_date } : {}),
        ...(to_date !== undefined ? { to_date } : {}),
      })

      if (result.isErr()) {
        yield err(result.error)
        return
      }

      const response = result.value

      for (const envelope of response.webhooks) {
        // Cast away the passthrough-inferred type; runtime shape matches WebhookEnvelope.
        yield ok(envelope as unknown as WebhookEnvelope)
      }

      if (response.webhooks.length < per_page) {
        return
      }

      page += 1
      if (page > ITERATE_UNDELIVERED_MAX_PAGES) {
        yield err(
          new ValidationError(
            `iterateUndelivered exceeded ${ITERATE_UNDELIVERED_MAX_PAGES} pages; tighten from_date/to_date or object_type filters`,
          ),
        )
        return
      }
    }
  }
}

// Safety cap. At default per_page=25 this is 250k envelopes — far past any
// realistic backlog. Exists only to keep a misconfigured filter from spinning
// forever; bump or remove if a real workload needs it.
const ITERATE_UNDELIVERED_MAX_PAGES = 10_000

// Strip trailing slashes so e.g. `https://x/y/` and `https://x/y` compare
// equal — avoids a PATCH every boot when GHIN normalizes the registered URL
// differently than the caller. Treats null (GHIN's "unregistered" sentinel
// in GET responses) the same as undefined.
const normalizeWebhookUrl = (url: string | null | undefined): string | undefined =>
  url == null ? undefined : url.replace(/\/+$/, '')

const describeLeaf = (value: string | boolean | null | undefined): string =>
  value == null ? '(not set)' : String(value)

export * from './models'
