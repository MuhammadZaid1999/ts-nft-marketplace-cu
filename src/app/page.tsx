"use client"; // Mark as a Client Component

import { useAccount } from "wagmi"
import { useEffect, useState } from "react";
import RecentlyListedNFTs from "@/components/RecentlyListed"

export default function Home() {
    const { isConnected, address } = useAccount()
    const [isCompliant, setIsCompliant] = useState(true)

    async function checkCompliance() {
        if(!address) return;

        try {
            const response = await fetch('/api/compliance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address }),
            });

            if(!response.ok) {
                // Handle API errors (e.g., backend down)
                console.error("Compliance API request failed:", response.statusText);
                setIsCompliant(false);
                return;
            }

            const result = await response.json();
            // Update state based on the backend's response structure
            // Assuming the API returns { success: boolean, isApproved: boolean }
            setIsCompliant(result.success && result.isApproved);
        
        } catch (error) {
            console.error("Error calling compliance API:", error);
            setIsCompliant(false); // Assume non-compliant on fetch error
        }
    }

    // Use useEffect to trigger the check when the address changes
    useEffect(() => {
        if (isConnected && address) {
            checkCompliance();
        } else {
            // Optional: Reset compliance status if disconnected
            setIsCompliant(true); // Or false, depending on desired default state
        }

        // ... rest of the component (conditional rendering)
    }, [isConnected, address]); // Dependencies: run when address or connection status changes

    return (
        <main>
            {!isConnected ? (
                <div className="flex items-center justify-center p-4 md:p-6 xl:p-8">
                    Please connect a wallet
                </div>
            ) : (
                isCompliant ? (
                    <div className="flex items-center justify-center p-4 md:p-6 xl:p-8">
                        <RecentlyListedNFTs />
                    </div>
                ) : (
                        <div className="items-center justify-center p-4 md:p-6 xl:p-8">
                            <h1>Access Denied</h1>
                            <p>Your connected wallet address is not permitted to use this application based on compliance checks.</p>
                        </div>
                    )
            )}
        </main>
    )
}
