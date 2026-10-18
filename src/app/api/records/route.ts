import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CAR_LIBRARY } from "@/game/cars/registry";
import { MAP_LIBRARY } from "@/game/maps/registry";

/** keep an id only if it exists in its registry — otherwise store null */
function validId(raw: unknown, library: { id: string }[]): string | null {
  if (typeof raw !== "string") return null;
  return library.some((x) => x.id === raw) ? raw : null;
}

export async function GET() {
  try {
    const records = await db.lapRecord.findMany({
      orderBy: { lapTimeMs: "asc" },
      take: 10,
    });
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Failed to fetch lap records:", error);
    return NextResponse.json({ records: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerName, lapTimeMs, mode, carColor, carId, mapId } = body;

    if (
      typeof playerName !== "string" ||
      !playerName.trim() ||
      typeof lapTimeMs !== "number" ||
      lapTimeMs <= 0 ||
      !["quick", "trial", "online"].includes(mode)
    ) {
      return NextResponse.json({ error: "Invalid record payload" }, { status: 400 });
    }

    const record = await db.lapRecord.create({
      data: {
        playerName: playerName.trim().slice(0, 24),
        lapTimeMs: Math.round(lapTimeMs),
        mode,
        carColor: typeof carColor === "string" ? carColor.slice(0, 9) : "#f59e0b",
        carId: validId(carId, CAR_LIBRARY),
        mapId: validId(mapId, MAP_LIBRARY),
      },
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error("Failed to save lap record:", error);
    return NextResponse.json({ error: "Failed to save record" }, { status: 500 });
  }
}
