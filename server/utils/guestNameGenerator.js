/**
 * Generate random guest display names like "Anonymous Platypus"
 */

const adjectives = [
  'Anonymous', 'Mysterious', 'Secret', 'Hidden', 'Shy',
  'Quiet', 'Silent', 'Sneaky', 'Stealthy', 'Subtle',
  'Clever', 'Swift', 'Quick', 'Bright', 'Cheerful',
  'Happy', 'Jolly', 'Merry', 'Playful', 'Curious'
];

const animals = [
  'Platypus', 'Penguin', 'Otter', 'Raccoon', 'Fox',
  'Panda', 'Koala', 'Sloth', 'Hamster', 'Squirrel',
  'Hedgehog', 'Ferret', 'Chinchilla', 'Capybara', 'Quokka',
  'Axolotl', 'Narwhal', 'Walrus', 'Manatee', 'Dolphin',
  'Octopus', 'Jellyfish', 'Starfish', 'Seahorse', 'Turtle',
  'Owl', 'Parrot', 'Toucan', 'Flamingo', 'Peacock'
];

export function generateGuestName() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective} ${animal}`;
}
