// Captured 2026-05-17 from api-uat.ghin.com (Druid Golf staging account)
// against the four GPA endpoints. Stringified IDs, the `success` envelope
// shape, and the unrelated outer fields on `/users/accesses.json` are all
// preserved verbatim from the wire so the schemas are exercised against
// real shapes rather than assumed ones.

export const getAccessesResponseFixture = {
  federations: [],
  associations: [],
  clubs: [],
  golfers: [
    {
      golfer: { id: '13373246' },
      user_access: {
        id: '6863457',
        golfer_name: 'Test Golfer1019',
        gpa_status: 'pending',
      },
    },
  ],
  super_user: 'false',
  subtype: null,
} as const

export const requestAccessResponseFixture = {
  success: 'The request was successfully sent to the Golfer.',
} as const

export const updateStatusResponseFixture = {
  success: 'Your response has been recorded, this request has been acknowledged.',
} as const

// Trailing space is USGA's, not a typo here.
export const revokeAccessResponseFixture = {
  success: 'You successfully revoked the Golfer Product Access for Druid Golf, Inc. ',
} as const
