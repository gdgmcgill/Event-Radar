// Taken from https://www.npmjs.com/package/next-swagger-doc
import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
    const spec = createSwaggerSpec({
        apiFolder: "src/app/api", // define api folder under app folder
        definition: {
            openapi: "3.1.0",
            info: {
                title: "Event Radar API Documentation",
                version: "1.0",
            },
            // Example ussage of components and security
            // components: {
            //     securitySchemes: {
            //         BearerAuth: {
            //             type: "http",
            //             scheme: "bearer",
            //             bearerFormat: "JWT",
            //         },
            //     },
            // },
            // security: [],
        },
    });
    return spec;
};