import { RankingTable } from "@/components/ranking/ranking-table";
import { getClubContext } from "@/data/club";
import { getSeasonRanking } from "@/data/ranking";

export default async function RankingPage() {
  const context = await getClubContext();
  if (!context.club) {
    return null;
  }

  const ranking = await getSeasonRanking(context.club.id);

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Season standings
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        {ranking.seasonName ?? "No open season"}
      </h1>
      <p className="text-sand/45 mt-3 max-w-xl text-sm leading-6">
        Rankings use cumulative net profit from finalized games. Equal profit
        shares the same rank.
      </p>
      <section className="mt-8">
        <RankingTable rows={ranking.rows} unitName={context.club.unitName} />
      </section>
    </main>
  );
}
