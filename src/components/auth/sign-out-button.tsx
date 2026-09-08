export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        className="text-sand/45 hover:text-mint min-h-10 rounded-full border border-white/10 px-3 text-xs font-semibold"
        type="submit"
      >
        Sign out
      </button>
    </form>
  );
}
