import { z } from "zod";
import { schemaFacility } from "./facility";

// The facilities API returns an array directly, not wrapped in an object
const schemaFacilitySearchResponse = z.array(schemaFacility);

type FacilitySearchResponse = z.infer<typeof schemaFacilitySearchResponse>;

export { schemaFacilitySearchResponse };
export type { FacilitySearchResponse };
