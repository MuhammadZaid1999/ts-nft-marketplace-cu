import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import NFTBox from "./NFTBox"
import Link from "next/link"

// Describes the detailed fields for a listed item
interface NftItem {
    rindexerId: string;
    seller: string;
    nftAddress: string;
    price: string; // Note: Blockchain values are often strings (BigInts)
    tokenId: string;
    contractAddress: string;
    txHash: string;
    blockNumber: string; // Often a string, may need parsing to number/BigInt
}

// Describes the minimal data needed for bought/cancelled items (for filtering)
interface BoughtCancelled {
    nftAddress: string;
    tokenId: string;
}

// Describes the overall structure of the GraphQL response JSON
interface NFTQueryResponse {
    data: {
        allItemListeds: {
            nodes: NftItem[]
        };
        allItemCancelleds: { // Ensure these names match your actual schema/query
            nodes: BoughtCancelled[]
        };
        allItemBoughts: { // Ensure these names match your actual schema/query
            nodes: BoughtCancelled[]
        };
    }
    // Optional: include 'errors' field if you want to type GraphQL errors
    errors?: Array<{ message: string;[key: string]: any }>;
}

const GET_RECENT_NFTS = `
        query getMarketplaceData {
            # Fetch the latest 20 listed items, newest first
            allItemListeds(first: 20, orderBy:[BLOCK_NUMBER_DESC, TX_INDEX_DESC]) {
                nodes {
                    rindexerId   # Unique ID from rindexer
                    seller
                    nftAddress
                    price
                    contractAddress   # Smart contract emitting the event
                    tokenId
                    txHash
                    blockNumber
                }
            }
            # Fetch all cancellation events (for filtering)
            allItemCanceleds {  # Matches the event name indexed by rindexer
                nodes {
                    nftAddress
                    tokenId
                }
            }
            # Fetch all purchase events (for filtering)
            allItemBoughts {  # Matches the event name indexed by rindexer
                nodes {
                    nftAddress
                    tokenId
                }
            }
        }`;

async function fetchNfts(): Promise<NFTQueryResponse> {
    const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: GET_RECENT_NFTS, // Pass our defined GraphQL query string
            // variables: {} // Add if your query uses GraphQL variables
        })
    });

    if (!response.ok) {
        // Handle HTTP errors (e.g., network issues, server errors)
        console.error("HTTP Error:", response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonResponse = await response.json();
    if (jsonResponse.errors) {
        // Handle GraphQL errors (e.g., syntax errors in the query)
        console.error("GraphQL Errors:", jsonResponse.errors);
        throw new Error(`GraphQL error: ${jsonResponse.errors.map((err: any) => err.message).join(", ")}`);
    }

    return jsonResponse as NFTQueryResponse; // Assert the type
}

function useRecentlyListedNFTs() {
    const { data, isLoading, error } = useQuery<NFTQueryResponse>({
        // queryKey: An array used by React Query to cache and manage this query.
        queryKey: ['recentNFTs'],
        // queryFn: The async function that resolves with the data or throws an error.
        queryFn: fetchNfts,
        // Options like refetchInterval can be added here if needed
    })

    const nftDataList = useMemo(() => {
        // If data hasn't loaded yet, or the nested structure is missing, return empty.
        // Optional chaining (?.) provides safety against runtime errors.
        if (!data?.data?.allItemListeds?.nodes) return [];

        // Create Sets for efficient O(1) average time complexity lookups.
        // Use unique identifiers combining address and token ID.
        const boughtNFTs = new Set<string>();
        data.data.allItemBoughts.nodes.forEach(item => {
            if (item.nftAddress && item.tokenId) {
                boughtNFTs.add(`${item.nftAddress}-${item.tokenId}`);
            }
        });

        const cancelledNFTs = new Set<string>();
        data.data.allItemCancelleds?.nodes.forEach((item) => {
            if (item.nftAddress && item.tokenId) {
                cancelledNFTs.add(`${item.nftAddress}-${item.tokenId}`);
            }
        });

        // Filter the listed NFTs. Keep only those NOT in the bought or cancelled sets.
        const activeNfts = data.data.allItemListeds.nodes.filter(item => {
            if (!item.nftAddress || !item.tokenId) return false; // Skip incomplete items
            const key = `${item.nftAddress}-${item.tokenId}`;
            return !boughtNFTs.has(key) && !cancelledNFTs.has(key);
        })

        // Optional: Limit the number of results if needed
        const recentActiveNfts = activeNfts.slice(0, 100);

        // Map the filtered data to the structure expected by our UI component (e.g., NFTBox).
        // Ensure prop names match what the component expects (e.g., contractAddress vs nftAddress).
        return recentActiveNfts.map(nft => ({
            tokenId: nft.tokenId,
            contractAddress: nft.nftAddress, // Mapping nftAddress to contractAddress prop
            price: nft.price,
            seller: nft.seller, // Include other needed props
        }));

        // The dependency array tells useMemo to recompute ONLY when 'data' changes.
    }, [data])

    // Return the memoized list and the query states.
    return { isLoading, error, nftDataList };
}


// Main component that uses the custom hook
export default function RecentlyListedNFTs() {
    const { isLoading, error, nftDataList } = useRecentlyListedNFTs();

    if (isLoading) {
        return <div>Loading recently listed NFTs...</div>;
    }

    if (error) {
        // Log the error for debugging
        console.error("Error fetching NFTs:", error);
        return <div>Error loading NFTs. Please try again later.</div>;
    }

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">Recently Listed</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {nftDataList && nftDataList.length > 0 ? (
                    nftDataList.map((nft) => (
                        // Wrap each NFTBox with a Link for navigation
                        <Link
                            href={`/buy-nft/${nft.contractAddress}/${nft.tokenId}`}
                            // Provide a unique key for the Link element
                            key={`${nft.contractAddress}-${nft.tokenId}-link`}
                        >
                            {/* Render the NFTBox component with data from our filtered list */}
                            <NFTBox
                                // React requires a unique key for each item in a list for efficient updates.
                                key={`${nft.contractAddress}-${nft.tokenId}`}
                                tokenId={nft.tokenId}
                                contractAddress={nft.contractAddress}
                                price={nft.price}
                            // Pass any other required props to NFTBox
                            />
                        </Link>
                    ))
                ) : (
                    // Display a message if no active NFTs are found
                    !isLoading && <div>No active NFT listings found.</div>
                )}
            </div>
        </div>
    );
}