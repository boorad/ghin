import { GhinClient } from "../../src";

const ghinClient = new GhinClient({
  apiAccess: process.env.GHIN_API_ACCESS === "true",
  apiVersion: process.env.GHIN_API_VERSION as "v1",
  baseUrl: process.env.GHIN_BASE_URL,
  password: process.env.GHIN_PASSWORD as string,
  username: process.env.GHIN_USERNAME as string,
});

async function test() {
  console.log("=".repeat(80));
  console.log("Testing course details for Druid Hills (course_id: 13995)");
  console.log("=".repeat(80));

  try {
    const details = await ghinClient.courses.getDetails({
      course_id: 13995,
      // tee_set_status defaults to "Active" - only returns current tees
      // Use "All" to include historical/deleted tees
      // Use "Deleted" to only see historical tees
      // gender: "M", // Optional: filter by gender ('M', 'm', 'F', 'f')
      // number_of_holes: 18, // Optional: filter by holes (9 or 18)
    });

    console.log("\n✓ Success! Course details:");
    console.log("CourseId:", details.CourseId);
    console.log("CourseName:", details.CourseName);
    console.log("CourseCity:", details.CourseCity);
    console.log(
      "Facility.GeoLocationFormattedAddress:",
      details.Facility.GeoLocationFormattedAddress
    );
    console.log(
      "Facility.GeoLocationLatitude:",
      details.Facility.GeoLocationLatitude
    );
    console.log(
      "Facility.GeoLocationLongitude:",
      details.Facility.GeoLocationLongitude
    );
    console.log("\nFull response:");
    console.dir(details, { depth: null });
  } catch (error) {
    console.error("\n✗ Error:", error);
  }
}

test();
