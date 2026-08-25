import PropTypes from "prop-types";

export function Navigation({ people }) {
  return (
    <ul className="nav">
      {people.map((person) => {
        return (
          <li key={person} className="nav-item">
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
