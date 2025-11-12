# Facilities vs Courses API Comparison

## Overview

This document compares the GHIN Facilities API and Courses API to understand their differences and determine how to create a unified interface.

## API Endpoints

- **Facilities**: `/facilities/search.json`
- **Courses**: `/crsCourseMethods.asmx/SearchCourses.json`

## Response Structure

### Facilities API Response

The facilities API returns an **array directly** (not wrapped in an object):

```json
[
  {
    "FacilityId": 11807,
    "FacilityStatus": "Active",
    "FacilityName": "Druid Hills Golf Club",
    "City": "Atlanta",
    "State": "US-GA",
    "Country": "USA",
    "EntCountryCode": 240,
    "EntStateCode": 200011,
    "UpdatedOn": "2018-12-06",
    "Associations": [],
    "Courses": [
      {
        "CourseId": 13995,
        "CourseStatus": "Active",
        "CourseName": "Druid Hills Golf Club",
        "NumberOfHoles": 18
      }
    ]
  }
]
```

### Courses API Response

The courses API returns an **object with a `courses` array**:

```json
{
  "courses": [
    {
      "CourseID": 13995,
      "CourseStatus": "Active",
      "CourseName": "Druid Hills Golf Club",
      "FacilityID": 11807,
      "FacilityStatus": "Active",
      "FacilityName": "Druid Hills Golf Club",
      "FullName": "Druid Hills Golf Club - Druid Hills Golf Club",
      "Address1": "740 Clifton Road NE",
      "Address2": null,
      "City": "Atlanta",
      "State": "US-GA",
      "Zip": "30307",
      "Country": "USA",
      "EntCountryCode": 240,
      "EntStateCode": 200011,
      "LegacyCRPCourseId": 29997,
      "Telephone": null,
      "Email": null,
      "UpdatedOn": "2018-12-06",
      "Ratings": []
    }
  ]
}
```

## Key Differences

### 1. **Response Wrapper**
- **Facilities**: Returns array directly
- **Courses**: Returns object with `courses` property

### 2. **Nested Course Information**
- **Facilities**: Includes nested `Courses` array with basic course info (CourseId, CourseName, NumberOfHoles, CourseStatus)
- **Courses**: Each course is a top-level item with full details

### 3. **Field Naming**
- **Facilities**: Uses `FacilityId` (no "ID" capitalization)
- **Courses**: Uses `CourseID` and `FacilityID` (capitalized "ID")

### 4. **Address Information**
- **Facilities**: No address fields in the search response
- **Courses**: Includes Address1, Address2, Zip, Telephone, Email

### 5. **Geolocation**
- **Facilities**: No geolocation fields in search response
- **Courses**: Schema expects GeoLocationLatitude/Longitude but they're not present in search response

### 6. **Additional Fields**
- **Facilities**: Includes `Associations` array, `NumberOfHoles` per course
- **Courses**: Includes `FullName`, `LegacyCRPCourseId`, `Ratings` array

## Real-World Examples

### Druid Hills Golf Club (Single Course Facility)
- **Facility**: 1 facility with 1 course
- **Courses**: 1 course result
- Both return the same FacilityID (11807) and CourseID (13995)

### Pinehurst Country Club (Multi-Course Facility)
- **Facility**: 1 facility with 9 courses (No. 1-9)
- **Courses**: 9 separate course results, all with same FacilityID (19361)
- Facility response is more concise for multi-course facilities

## Unified API Strategy

### When to Use Facilities API
1. **Searching for golf courses by location or name** - More efficient for initial search
2. **Getting a list of all courses at a facility** - Single call returns all courses
3. **When you don't need detailed course information** - Lighter response
4. **Multi-course facilities** - Much more efficient (1 result vs N results)

### When to Use Courses API
1. **Need detailed course information** - Address, contact info, ratings
2. **Searching for specific course by CourseID**
3. **Need course ratings information**
4. **Working with individual courses** - When facility grouping isn't needed

### Recommended Unified Approach

```typescript
// High-level search - use Facilities API
async searchGolfCourses(params) {
  const facilities = await facilities.search(params)
  // Returns facilities with nested course lists
  return facilities
}

// Detailed course lookup - use Courses API
async getCourseDetails(courseId) {
  const course = await courses.getDetails({ course_id: courseId })
  // Returns full course details including ratings
  return course
}

// Hybrid approach for comprehensive search
async searchCoursesWithDetails(params) {
  // 1. Use facilities API to get list
  const facilities = await facilities.search(params)
  
  // 2. Extract course IDs
  const courseIds = facilities.flatMap(f => 
    f.Courses?.map(c => c.CourseId) || []
  )
  
  // 3. Fetch details for each course (could be batched)
  const courseDetails = await Promise.all(
    courseIds.map(id => courses.getDetails({ course_id: id }))
  )
  
  return courseDetails
}
```

## Issues Found

### 1. GeoLocation Schema Issue
The course model expects `GeoLocationLatitude` and `GeoLocationLongitude` fields, but the search API doesn't return them (they're undefined, which `z.coerce.number()` converts to NaN).

**Fix**: Make geolocation fields optional in the course schema.

### 2. Field Name Inconsistency
- Facilities use: `FacilityId`, `CourseId`
- Courses use: `FacilityID`, `CourseID`

**Fix**: Schema should handle both or normalize to one format.

### 3. Different Data Depth
- Facilities: Breadth-first (show all courses at facility briefly)
- Courses: Depth-first (show one course in detail)

**Fix**: Provide both interfaces and let consumers choose based on use case.

## Recommendations

1. **Keep both APIs separate** - They serve different purposes
2. **Fix geolocation schema** - Make fields optional or handle missing data
3. **Create convenience methods** - Provide helpers that combine both APIs intelligently
4. **Document use cases** - Clear guidance on when to use each API
5. **Consider caching** - Facilities search could cache to avoid repeated course detail lookups
