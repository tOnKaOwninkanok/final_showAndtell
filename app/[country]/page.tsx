import Link from "next/link";

type ResultPageProps = {
    params: Promise<{ country: string }>;
};

type BankHoliday = {
    holiday_id: string;
    name: string;
    date: string;
    regions: string[];
};

export default async function ResultPage({ params }: ResultPageProps) {
    const { country } = await params;

    const apiKey = process.env.API_NINJAS_KEY;
    let holidays: BankHoliday[] = [];
    let errorMessage = "";

    try {
        if (!apiKey) {
            throw new Error("Missing API_NINJAS_KEY in .env.local");
        }

        const response = await fetch(
            `https://api.api-ninjas.com/v1/bankholidays?country=${encodeURIComponent(country)}`,
            {
                headers: {
                    "X-Api-Key": apiKey,
                },
                cache: "no-store",
                signal: AbortSignal.timeout(10000),
            }
        );

        if (!response.ok) {
            throw new Error(
            response.status === 429
                ? "API usage limit reached. Please try again later."
                : "Unable to load holidays. Please try again later."
            );
        }

        holidays = await response.json();
    } catch (error) {
        errorMessage =
        error instanceof Error ? error.message : "Something went wrong.";
    }

    if (errorMessage) {
        return (
            <main style={{ padding: "32px" }}>
            <h2>Unable to load Countdown Holidays</h2>
            <p role="alert">{errorMessage}</p>
            <Link href="/">Back to Search</Link>
            </main>
        );
    } else {
        return (
            <main
                style={{
                    maxWidth: "480px",
                    margin: "60px auto",
                    padding: "32px",
                    backgroundColor: "white",
                    borderRadius: "12px",
                }}
            >
                <h2>Countdown Holidays Result</h2>

                <p>
                    Country: <strong>{country}</strong>
                </p>


                <Link href="/">Back to Search</Link>
                <p>Found {holidays.length} holidays</p>

                {holidays.length === 0 ? (
                    <p>No Countdown Holidays found.</p>
                ) : (
                    <ul
                        style={{
                            listStyle: "none",
                            padding: 0,
                            margin: "24px 0",
                        }}
                    >
                        {holidays.map((holiday) => (
                            <li
                                key={`${holiday.holiday_id}-${holiday.date}-${holiday.regions.join(",")}`}
                                style={{
                                    padding: "16px",
                                    marginBottom: "12px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                }}
                            >
                                <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>
                                    {holiday.name}
                                </h3>

                                <p style={{ margin: 0, color: "#4b5563" }}>
                                    Date: {holiday.date}
                                </p>

                                {holiday.regions.length > 0 && (
                                    <p style={{ margin: "8px 0 0", color: "#4b5563" }}>
                                        Regions: {holiday.regions.join(", ")}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                
            </main>
        );
    }
}