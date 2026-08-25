interface NavigationProps {
  people: string[];
}

export function Navigation({ people }: NavigationProps) {
  return (
    <ul className="list-none inline-flex rounded-tr-[2rem] rounded-bl-[2rem] bg-secondary text-ink py-0 px-[10px]">
      {people.map((person) => {
        return (
          <li key={person} className="p-4 text-[1.3rem]">
            <a href={`#${person}`}>{person}</a>
          </li>
        );
      })}
    </ul>
  );
}
