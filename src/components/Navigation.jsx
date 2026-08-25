import PropTypes from "prop-types";

export function Navigation({ people }) {
  return (
    <ul className="list-none inline-flex rounded-tr-[2rem] rounded-bl-[2rem] bg-[rgb(84,204,164)] py-0 px-[10px]">
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

Navigation.propTypes = {
  people: PropTypes.arrayOf(PropTypes.string).isRequired,
};
