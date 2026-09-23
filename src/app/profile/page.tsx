import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DeleteSearchButton from "@/components/DeleteSearchButton";
import ProfileCard from "@/components/ProfileCard";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    include: {
      searches: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      // Полное число подборов, а не только показанные пять: его показываем
      // в предупреждении при удалении получателя.
      _count: { select: { searches: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="gradient-brand flex h-12 w-12 items-center justify-center rounded-full text-xl">
          👋
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            Личный кабинет
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">
          Получатели подарков
        </h2>
        <Link
          href="/search"
          className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          + Новый подбор
        </Link>
      </div>

      {profiles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Пока нет сохранённых профилей получателей.{" "}
          <Link href="/search" className="font-semibold text-primary hover:underline">
            Подобрать первый подарок
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            searchCount={profile._count.searches}
            profile={{
              id: profile.id,
              name: profile.name,
              gender: profile.gender,
              age: profile.age,
              relationship: profile.relationship,
              job: profile.job,
              interests: profile.interests,
            }}
          >
            {profile.searches.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
                {profile.searches.map((search) => (
                  <li key={search.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Link
                        href={`/results?searchId=${search.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {search.occasion}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        · {new Date(search.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </span>
                    <DeleteSearchButton searchId={search.id} />
                  </li>
                ))}
              </ul>
            )}
          </ProfileCard>
        ))}
      </div>
    </div>
  );
}
