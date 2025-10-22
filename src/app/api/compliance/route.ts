// src/app/api/compliance/route.ts
import { v4 as uuidv4 } from 'uuid';

// Handles POST requests to /api/compliance
export async function POST(requests: Request) { // Use standard Request type
    try {
        // 1. Get address from request body
        // Assumes the client sends a JSON body like: { "address": "0x..." }
        const { address } = await requests.json();

        // 2. Validate input: Ensure address is provided
        if (!address) {
            return Response.json( // Use standard Response.json
                { error: 'Address is required', success: false },
                { status: 400 }
            );
        }

        // 3. Feature Flag Check: See if the compliance check is enabled
        const complianceEnabled = process.env.ENABLE_COMPLIANCE_CHECK === 'true';
        if(!complianceEnabled) {
            console.log('Compliance check is disabled via environment variable.');
            // Return a default success response indicating approval (useful for dev/testing)
            return Response.json({
                success: true,
                isApproved: true,
                data: { result: "APPROVED", message: "Complaince check is disabled" }
            });
        }

        // 4. Securely Retrieve API Key: Get key from server-side environment variables
        const circleApiKey = process.env.CIRCLE_API_KEY;
        if(!circleApiKey) {
            console.error('Server configuration error: CIRCLE_API_KEY is not set.');
            return Response.json( // Use standard Response.json
                { error: 'Server configuration error', success: false },
                { status: 500 }
            );
        }

        // 5. Prepare For External API Call
        const idempotencyKey = uuidv4(); // Generate a unique key for the request
        const chain = 'ETH-SEPOLIA'; // Define the blockchain (can be dynamic if needed)
        const circleApiUrl = 'https://api.circle.com/v1/w3s/compliance/screening/addresses';

        console.log(`Calling Circle API for address: ${address} with key: ${idempotencyKey}`);

        // 6. Make the Server-Side Fetch Call to Circle API

        const circleResponse = await fetch(circleApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // The API key is securely added here, never exposed to the client
                'Authorization': `Bearer ${circleApiKey}`,
            },
            body: JSON.stringify({
                idempotencyKey,
                address,
                chain // Using object shorthand for { chain: chain }
            })
        });

        // 7. Process the External API Response
        const responseData = await circleResponse.json(); // Parse the JSON response from Circle

        if(!circleResponse.ok) {
            console.error('Circle API Error:', circleResponse.status, responseData);
           // Propagate a meaningful error based on Circle's response if possible
            return Response.json( // Use standard Response.json
                { error: `Circle API request failed: ${responseData.message ||  circleResponse.statusText}`, success: false, details: responseData },
                { status: circleResponse.status } 
            );
        }

        // Determine approval status based on Circle's specific response structure
        // Adjust this logic based on the actual structure of `responseData` from Circle
        const isApproved = responseData?.data?.result === 'APPROVED';
        console.log(`Circle API response for ${address}: Approved = ${isApproved}`);

        // 8. Return Structured Response to Client
        // Send back a consistent format including success status, approval, and original data
        return Response.json({ // Use standard Response.json
            success: true,
            isApproved: isApproved,
            data: responseData // Return the original data payload from Circle
        });
            
    } catch (error) {
        // 9. Handle Unexpected Internal Errors
        console.error('Internal server error in /api/compliance:', error);
        return Response.json( // Use standard Response.json
            { error: 'Internal server error', success: false },
            { status: 500 } // Internal Server Error status
        );
    }
}