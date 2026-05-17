import { z } from 'zod'
import { ConfigurationError, ValidationError } from '../../errors'
import { type ClientConfig, number, schemaClientConfig } from '../../models'
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
  type HandicapResponse,
  type IterateUndeliveredRequest,
  type PlayingHandicapRequest,
  type PlayingHandicapsResponse,
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
  schemaGolferHandicapResponse,
  schemaGolfersGlobalSearchRequest,
  schemaGolfersSearchRequest,
  schemaGolfersSearchResponse,
  schemaGpaRequestAccessRequest,
  schemaGpaSuccessResponse,
  schemaGpaUpdateStatusRequest,
  schemaIterateUndeliveredRequest,
  schemaPlayingHandicapRequest,
  schemaPlayingHandicapsResponse,
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
    getCountries: () => Promise<CourseCountry[]>
    getDetails: (request: CourseDetailsRequest) => Promise<CourseDetailsResponse>
    search: (request: CourseSearchRequest) => Promise<CourseSearchResponse['courses']>
    getTeeSetRating: (request: TeeSetRatingRequest) => Promise<TeeSetRatingResponse>
    getTeeSetRatingsForScorePosting: (
      request: TeeSetRatingForScorePostingRequest,
    ) => Promise<TeeSetRatingsForScorePostingResponse>
  }

  facilities: {
    search: (request: FacilitySearchRequest) => Promise<FacilitySearchResponse>
  }

  golfers: {
    getOne: (ghinNumber: number) => Promise<GolfersSearchResponse['golfers'][number] | undefined>
    getScores: (ghinNumber: number, request?: ScoresRequest) => Promise<ScoresResponse>
    search: (request: GolfersSearchRequest) => Promise<GolfersSearchResponse['golfers']>
    globalSearch: (request: GolfersGlobalSearchRequest) => Promise<GolfersSearchResponse['golfers']>
  }

  gpa: {
    getAccesses: () => Promise<GpaAccess[]>
    requestAccess: (golferId: number, request: GpaRequestAccessRequest) => Promise<GpaSuccessResponse>
    updateStatus: (request: GpaUpdateStatusRequest) => Promise<GpaSuccessResponse>
    revokeAccess: (golferId: number) => Promise<GpaSuccessResponse>
  }

  handicaps: {
    getOne: (ghinNumber: number) => Promise<HandicapResponse['golfer']>
    getCoursePlayerHandicaps: (requests: GolferCourseHandicapRequest[]) => Promise<CoursePlayerHandicapsResponse>
    getCourseHandicaps: (request: CourseHandicapGetRequest) => Promise<CourseHandicapsGetResponse>
    getPlayingHandicaps: (request: PlayingHandicapRequest) => Promise<PlayingHandicapsResponse>
  }

  scores: {
    postHoleByHole: (request: ScorePostHbhRequest) => Promise<ScorePostResponse>
    postAdjusted: (request: ScorePostAdjustedRequest) => Promise<ScorePostResponse>
    post18h9and9: (request: ScorePost18h9and9Request) => Promise<ScorePostResponse>
  }

  webhooks: {
    get: () => Promise<WebhookSettings>
    patch: (settings: WebhookSettingsPatch) => Promise<WebhookSettings>
    delete: () => Promise<WebhookSuccessResponse>
    test: (type: WebhookEventType) => Promise<WebhookSuccessResponse>
    list: (request?: WebhooksListRequest) => Promise<WebhooksListResponse>
    resend: (request: WebhookResendRequest) => Promise<WebhookSuccessResponse>
    ensureRegistered: (request: EnsureRegisteredRequest) => Promise<EnsureRegisteredResult>
    iterateUndelivered: (request?: IterateUndeliveredRequest) => AsyncGenerator<WebhookEnvelope, void, void>
  }

  constructor(config: ClientConfig) {
    const results = schemaClientConfig.safeParse(config)

    if (!results.success) {
      throw new ConfigurationError(`Invalid GhinClientConfig: ${results.error.message}`)
    }

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
      getPlayingHandicaps: this.handicapsGetPlayingHandicaps.bind(this),
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

  private async coursesGetCountries(): Promise<CourseCountry[]> {
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

      if (result.isErr()) {
        throw result.error
      }

      return result.value.countries
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async courseGetDetails(request: CourseDetailsRequest): Promise<CourseDetailsResponse> {
    try {
      const validRequest = schemaCourseDetailsRequest.parse(request)
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
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid course details request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async courseGetTeeSetRating(request: TeeSetRatingRequest): Promise<TeeSetRatingResponse> {
    try {
      const validRequest = schemaTeeSetRatingRequest.parse(request)
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

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid tee set rating request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async courseGetTeeSetRatingsForScorePosting(
    request: TeeSetRatingForScorePostingRequest,
  ): Promise<TeeSetRatingsForScorePostingResponse> {
    try {
      const validRequest = schemaTeeSetRatingForScorePostingRequest.parse(request)
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
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid tee set rating for score posting request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async courseSearch(request: CourseSearchRequest): Promise<CourseSearchResponse['courses']> {
    try {
      const validRequest = schemaCourseSearchRequest.parse(request)
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
        throw result.error
      }

      return result.value.courses
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid course search request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // ── Facilities ───────────────────────────────────────────────────────

  private async facilitySearch(request: FacilitySearchRequest): Promise<FacilitySearchResponse> {
    try {
      const validRequest = schemaFacilitySearchRequest.parse(request)
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

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid facility search request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // ── GPA (Golfer Product Access) ──────────────────────────────────────

  // The endpoint is USGA's "UserAccesses" (not GPA-specific) and returns
  // federations/associations/clubs alongside golfers. Flatten the `golfers`
  // branch — the only one that carries GPA state — into a clean array so
  // callers don't have to deal with the unrelated outer fields.
  private async gpaGetAccesses(): Promise<GpaAccess[]> {
    try {
      const result = await this.httpClient.fetch<UserAccessesResponse>({
        entity: 'gpa_accesses',
        schema: schemaUserAccessesResponse,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value.golfers.map((entry) => ({
        golferId: entry.golfer.id,
        userAccessId: entry.user_access.id,
        golferName: entry.user_access.golfer_name,
        gpaStatus: entry.user_access.gpa_status,
      }))
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // USGA requires an `email` in the POST body; without it the endpoint
  // returns 400 `{ errors: { email: ["can't be blank"] } }`. The on-file
  // golfer email is the safe choice; whether USGA validates it against
  // their records or accepts any string is unconfirmed.
  private async gpaRequestAccess(golferId: number, request: GpaRequestAccessRequest): Promise<GpaSuccessResponse> {
    try {
      const id = number.positive().parse(golferId)
      const { email } = schemaGpaRequestAccessRequest.parse(request)

      const path = `/users/golfers/${id}/request_golfer_product_access.json`

      const result = await this.httpClient.fetchCustomPath<GpaSuccessResponse>({
        path,
        schema: schemaGpaSuccessResponse,
        options: {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid GPA request access request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // `user_id` here is the **credentialed admin user's** `user.id` from
  // `POST /users/login.json` — *not* the golfer's user and *not* the
  // `userAccessId` returned by `getAccesses()`. Easy to confuse; the URL
  // accepts all three numerically but only the admin id is authorized.
  private async gpaUpdateStatus(request: GpaUpdateStatusRequest): Promise<GpaSuccessResponse> {
    try {
      const validRequest = schemaGpaUpdateStatusRequest.parse(request)

      const path = `/users/${validRequest.user_id}/golfers/${validRequest.golfer_id}/update_golfer_product_access_status.json`

      const result = await this.httpClient.fetchCustomPath<GpaSuccessResponse>({
        path,
        schema: schemaGpaSuccessResponse,
        options: {
          method: 'POST',
          body: JSON.stringify({ gpa_status: validRequest.status }),
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid GPA update status request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // Revoke marks the underlying `user_access` record `inactive`; it does
  // not delete it. Re-firing `requestAccess` against the same golfer
  // reuses that record and flips status back to `pending`.
  private async gpaRevokeAccess(golferId: number): Promise<GpaSuccessResponse> {
    try {
      const id = number.positive().parse(golferId)

      const path = `/users/golfers/${id}/revoke_golfer_product_access.json`

      const result = await this.httpClient.fetchCustomPath<GpaSuccessResponse>({
        path,
        schema: schemaGpaSuccessResponse,
        options: {
          method: 'DELETE',
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid golfer ID: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // ── Handicaps ────────────────────────────────────────────────────────

  private async handicapsGetOne(ghin: number): Promise<HandicapResponse['golfer']> {
    try {
      const ghinNumber = number.parse(ghin)

      const searchParams = new URLSearchParams([
        ['source', CLIENT_SOURCE],
        ['ghin', ghinNumber.toString()],
      ])

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        searchParams,
      }

      const result = await this.httpClient.fetch<HandicapResponse>({
        entity: 'golfer',
        options,
        schema: schemaGolferHandicapResponse,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value.golfer
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid GHIN number: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async handicapsGetCoursePlayerHandicaps(
    request: GolferCourseHandicapRequest[],
  ): Promise<CoursePlayerHandicapsResponse> {
    try {
      const golfers = z
        .array(schemaGolferCourseHandicapRequest)
        .parse(request)
        .map(({ ghin, ...golfer }) => ({
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
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid course handicap request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async handicapsGetCourseHandicaps(request: CourseHandicapGetRequest): Promise<CourseHandicapsGetResponse> {
    try {
      const validRequest = schemaCourseHandicapGetRequest.parse(request)
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
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid course handicap request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async handicapsGetPlayingHandicaps(request: PlayingHandicapRequest): Promise<PlayingHandicapsResponse> {
    try {
      const validRequest = schemaPlayingHandicapRequest.parse(request)

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(validRequest),
      }

      const result = await this.httpClient.fetch<PlayingHandicapsResponse>({
        entity: 'playing_handicaps_post',
        options,
        schema: schemaPlayingHandicapsResponse,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid playing handicap request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // ── Golfers ──────────────────────────────────────────────────────────

  private async golfersSearch(request: GolfersSearchRequest): Promise<GolfersSearchResponse['golfers']> {
    try {
      const params = schemaGolfersSearchRequest.parse(request)
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
        throw result.error
      }

      return result.value.golfers
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid golfer search request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async golfersGlobalSearch(request: GolfersGlobalSearchRequest): Promise<GolfersSearchResponse['golfers']> {
    try {
      const { ghin, ...rest } = schemaGolfersGlobalSearchRequest.parse(request)
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
        throw result.error
      }

      return result.value.golfers
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid golfer search request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async golfersGetOne(ghinNumber: number): Promise<GolfersSearchResponse['golfers'][number] | undefined> {
    try {
      const ghin = number.parse(ghinNumber)
      const results = await this.golfersSearch({
        golfer_id: ghin,
        page: 1,
        per_page: 1,
        status: 'Active',
      })

      return results[0]
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid GHIN number: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async golfersGetScores(ghinNumber: number, request?: ScoresRequest): Promise<ScoresResponse> {
    try {
      const validRequest = schemaScoresRequest.parse(request) ?? {}
      const ghin = number.parse(ghinNumber)

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
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid scores request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // ── Score Posting ────────────────────────────────────────────────────

  private async scoresPostHoleByHole(request: ScorePostHbhRequest): Promise<ScorePostResponse> {
    try {
      const validRequest = schemaScorePostHbhRequest.parse(request)

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(validRequest),
      }

      const result = await this.httpClient.fetch<{ score: ScorePostResponse }>({
        entity: 'scores_hbh',
        options,
        schema: schemaScorePostResponse,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value.score
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid hole-by-hole score request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async scoresPostAdjusted(request: ScorePostAdjustedRequest): Promise<ScorePostResponse> {
    try {
      const validRequest = schemaScorePostAdjustedRequest.parse(request)

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(validRequest),
      }

      const result = await this.httpClient.fetch<{ score: ScorePostResponse }>({
        entity: 'scores_adjusted',
        options,
        schema: schemaScorePostResponse,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value.score
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid adjusted score request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async scoresPost18h9and9(request: ScorePost18h9and9Request): Promise<ScorePostResponse> {
    try {
      const validRequest = schemaScorePost18h9and9Request.parse(request)

      const options: Parameters<typeof this.httpClient.fetch>[0]['options'] = {
        method: 'POST',
        body: JSON.stringify(validRequest),
      }

      const result = await this.httpClient.fetch<{ score: ScorePostResponse }>({
        entity: 'scores_18h9and9',
        options,
        schema: schemaScorePostResponse,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value.score
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid 18h 9-and-9 score request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // ── Webhooks ─────────────────────────────────────────────────────────

  private async webhooksGet(): Promise<WebhookSettings> {
    try {
      const result = await this.httpClient.fetchCustomPath<WebhookSettings>({
        path: '/user/webhook_settings.json',
        schema: schemaWebhookSettings,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async webhooksPatch(settings: WebhookSettingsPatch): Promise<WebhookSettings> {
    try {
      const validRequest = schemaWebhookSettingsPatch.parse(settings)

      const result = await this.httpClient.fetchCustomPath<WebhookSettings>({
        path: '/user/webhook_settings.json',
        schema: schemaWebhookSettings,
        options: {
          method: 'PATCH',
          body: JSON.stringify(validRequest),
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid webhook settings patch: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async webhooksDelete(): Promise<WebhookSuccessResponse> {
    try {
      const result = await this.httpClient.fetchCustomPath<WebhookSuccessResponse>({
        path: '/user/webhook_settings.json',
        schema: schemaWebhookSuccessResponse,
        options: {
          method: 'DELETE',
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async webhooksTest(type: WebhookEventType): Promise<WebhookSuccessResponse> {
    try {
      const validType = schemaWebhookEventType.parse(type)
      const searchParams = new URLSearchParams([['type', validType]])

      const result = await this.httpClient.fetchCustomPath<WebhookSuccessResponse>({
        path: '/user/webhook_settings/test.json',
        schema: schemaWebhookSuccessResponse,
        options: {
          searchParams,
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid webhook event type: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async webhooksList(request: WebhooksListRequest = {}): Promise<WebhooksListResponse> {
    try {
      const validRequest = schemaWebhooksListRequest.parse(request)
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

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid webhooks list request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  private async webhooksResend(request: WebhookResendRequest): Promise<WebhookSuccessResponse> {
    try {
      const validRequest = schemaWebhookResendRequest.parse(request)
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

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid webhook resend request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // Idempotent registration: GET current settings, PATCH only if the leaf for
  // the given event differs. PATCH upstream is itself idempotent, so a
  // spurious update round-trips harmlessly; the GET-first dance just avoids
  // the side-effect when nothing has changed.
  private async webhooksEnsureRegistered(request: EnsureRegisteredRequest): Promise<EnsureRegisteredResult> {
    try {
      const { event, url, dataType, enabled } = schemaEnsureRegisteredRequest.parse(request)
      const current = await this.webhooksGet()

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
        return { changed: false, settings: current }
      }

      const settings = await this.webhooksPatch({
        webhook_url: { [event]: url },
        webhook_data_type: { [event]: dataType },
        webhook_enabled: { [event]: enabled },
      })

      return { changed: true, reason: reasons.join('; '), settings }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid ensureRegistered request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // Pages through `status=not sent` deliveries and yields each envelope.
  // Stops when a page returns fewer than `per_page` results, so the caller
  // doesn't have to track pagination state. Filter by object_type/from_date
  // to bound the scan window in a recovery worker.
  private async *webhooksIterateUndelivered(
    request: IterateUndeliveredRequest = {},
  ): AsyncGenerator<WebhookEnvelope, void, void> {
    let validRequest: ReturnType<typeof schemaIterateUndeliveredRequest.parse>
    try {
      validRequest = schemaIterateUndeliveredRequest.parse(request)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid iterateUndelivered request: ${error.message}`)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }

    const { per_page, object_type, from_date, to_date } = validRequest

    let page = 1
    while (true) {
      const response = await this.webhooksList({
        page,
        per_page,
        status: 'not sent',
        ...(object_type !== undefined ? { object_type } : {}),
        ...(from_date !== undefined ? { from_date } : {}),
        ...(to_date !== undefined ? { to_date } : {}),
      })

      for (const envelope of response.webhooks) {
        // Cast away the passthrough-inferred type; runtime shape matches WebhookEnvelope.
        yield envelope as unknown as WebhookEnvelope
      }

      if (response.webhooks.length < per_page) {
        return
      }

      page += 1
      if (page > ITERATE_UNDELIVERED_MAX_PAGES) {
        throw new Error(
          `iterateUndelivered exceeded ${ITERATE_UNDELIVERED_MAX_PAGES} pages; tighten from_date/to_date or object_type filters`,
        )
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
