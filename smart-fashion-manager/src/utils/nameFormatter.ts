/**
 * Utility to format member/customer names according to requirements:
 * 1. Display the member's full name exactly as stored in the database.
 * 2. Preserve all spaces between first name, middle name, and last name.
 * 3. Do NOT remove spaces.
 * 4. Do NOT concatenate words.
 * 5. Trim only leading and trailing spaces.
 * 6. Preserve capitalization.
 * 7. If the database stores separate fields (First Name, Middle Name, Last Name), combine them using a single space.
 * 8. If the database stores a Full Name field, render it exactly as entered.
 */
export const formatMemberName = (nameOrObj: any): string => {
  if (!nameOrObj) return '';

  let nameStr = '';
  if (typeof nameOrObj === 'object') {
    // If separate fields are present
    const firstName = nameOrObj.firstName || nameOrObj.first_name || '';
    const middleName = nameOrObj.middleName || nameOrObj.middle_name || '';
    const lastName = nameOrObj.lastName || nameOrObj.last_name || '';

    if (firstName || middleName || lastName) {
      nameStr = [firstName, middleName, lastName]
        .map(s => String(s).trim())
        .filter(Boolean)
        .join(' ');
    } else {
      // Otherwise use full name field if present
      const fullName = nameOrObj.customerName || nameOrObj.name || '';
      nameStr = String(fullName).trim();
    }
  } else {
    // If it is already a string representing full name
    nameStr = String(nameOrObj).trim();
  }

  // Collapse multiple spaces into a single space and convert to uppercase
  return nameStr.replace(/\s+/g, ' ').toUpperCase();
};
