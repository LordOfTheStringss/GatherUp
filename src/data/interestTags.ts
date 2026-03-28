export interface InterestTag {
    id: string;
    title: string;
    category: string;
    icon: string;
    color: string;
}

export const CATEGORY_COLORS: Record<string, string> = {
    'Sports': '#3B82F6',
    'Tech & Science': '#8B5CF6',
    'Arts & Culture': '#EC4899',
    'Hobbies': '#8910b9',
    'Social': '#10B981',
};

export const INTEREST_TAGS: InterestTag[] = [
    // SPORTS
    { id: '1', title: 'Volleyball', category: 'Sports', icon: 'fitness', color: '#3B82F6' },
    { id: '2', title: 'Basketball', category: 'Sports', icon: 'basketball', color: '#3B82F6' },
    { id: '3', title: 'Football', category: 'Sports', icon: 'football', color: '#3B82F6' },
    { id: '4', title: 'Tennis', category: 'Sports', icon: 'tennis-ball', color: '#3B82F6' },
    { id: '5', title: 'Swimming', category: 'Sports', icon: 'water', color: '#3B82F6' },
    { id: '6', title: 'Running', category: 'Sports', icon: 'walk', color: '#3B82F6' },
    { id: '7', title: 'Yoga', category: 'Sports', icon: 'body', color: '#3B82F6' },
    { id: '8', title: 'Pilates', category: 'Sports', icon: 'body-outline', color: '#3B82F6' },
    { id: '9', title: 'Fitness', category: 'Sports', icon: 'barbell', color: '#3B82F6' },
    { id: '10', title: 'Skateboarding', category: 'Sports', icon: 'bicycle', color: '#3B82F6' },
    { id: '11', title: 'Cycling', category: 'Sports', icon: 'bicycle', color: '#3B82F6' },
    { id: '12', title: 'Archery', category: 'Sports', icon: 'navigate', color: '#3B82F6' },
    { id: '13', title: 'Mountaineering', category: 'Sports', icon: 'image', color: '#3B82F6' },
    { id: '14', title: 'Boxing', category: 'Sports', icon: 'hand-left', color: '#3B82F6' },
    { id: '15', title: 'Table Tennis', category: 'Sports', icon: 'tennisball-outline', color: '#3B82F6' },

    // TECH & SCIENCE
    { id: '16', title: 'Software', category: 'Tech & Science', icon: 'code-slash', color: '#8B5CF6' },
    { id: '17', title: 'AI', category: 'Tech & Science', icon: 'hardware-chip', color: '#8B5CF6' },
    { id: '18', title: 'Data Science', category: 'Tech & Science', icon: 'bar-chart', color: '#8B5CF6' },
    { id: '19', title: 'Cyber Security', category: 'Tech & Science', icon: 'shield-checkmark', color: '#8B5CF6' },
    { id: '20', title: 'Robotics', category: 'Tech & Science', icon: 'cog', color: '#8B5CF6' },
    { id: '21', title: 'Game Dev', category: 'Tech & Science', icon: 'game-controller', color: '#8B5CF6' },
    { id: '22', title: 'Blockchain', category: 'Tech & Science', icon: 'link', color: '#8B5CF6' },
    { id: '23', title: 'Astronomy', category: 'Tech & Science', icon: 'planet', color: '#8B5CF6' },
    { id: '24', title: 'Electronics', category: 'Tech & Science', icon: 'bulb', color: '#8B5CF6' },

    // ARTS & CULTURE
    { id: '25', title: 'Theater', category: 'Arts & Culture', icon: 'color-palette', color: '#EC4899' },
    { id: '26', title: 'Cinema', category: 'Arts & Culture', icon: 'film', color: '#EC4899' },
    { id: '27', title: 'Concerts', category: 'Arts & Culture', icon: 'musical-notes', color: '#EC4899' },
    { id: '28', title: 'Dance', category: 'Arts & Culture', icon: 'body', color: '#EC4899' },
    { id: '29', title: 'Painting', category: 'Arts & Culture', icon: 'brush', color: '#EC4899' },
    { id: '30', title: 'Sculpture', category: 'Arts & Culture', icon: 'hammer', color: '#EC4899' },
    { id: '31', title: 'Literature', category: 'Arts & Culture', icon: 'book', color: '#EC4899' },
    { id: '32', title: 'Photography', category: 'Arts & Culture', icon: 'camera', color: '#EC4899' },
    { id: '33', title: 'Exhibitions', category: 'Arts & Culture', icon: 'images', color: '#EC4899' },
    { id: '34', title: 'Stand-up', category: 'Arts & Culture', icon: 'mic', color: '#EC4899' },
    { id: '35', title: 'Museums', category: 'Arts & Culture', icon: 'business', color: '#EC4899' },
    { id: '36', title: 'Opera', category: 'Arts & Culture', icon: 'musical-notes-outline', color: '#EC4899' },

    // HOBBIES & LIFESTYLE
    { id: '37', title: 'Camping', category: 'Hobbies', icon: 'leaf', color: '#8910b9' },
    { id: '38', title: 'Chess', category: 'Hobbies', icon: 'extension-puzzle', color: '#8910b9' },
    { id: '39', title: 'Reading', category: 'Hobbies', icon: 'book-outline', color: '#8910b9' },
    { id: '40', title: 'Cooking', category: 'Hobbies', icon: 'restaurant', color: '#8910b9' },
    { id: '41', title: 'Gastronomy', category: 'Hobbies', icon: 'fast-food', color: '#8910b9' },
    { id: '42', title: 'E-sports', category: 'Hobbies', icon: 'headset', color: '#8910b9' },
    { id: '43', title: 'Gardening', category: 'Hobbies', icon: 'flower', color: '#8910b9' },
    { id: '44', title: 'Traveling', category: 'Hobbies', icon: 'airplane', color: '#8910b9' },
    { id: '45', title: 'Languages', category: 'Hobbies', icon: 'language', color: '#8910b9' },
    { id: '46', title: 'Collecting', category: 'Hobbies', icon: 'albums', color: '#8910b9' },
    { id: '47', title: 'Guitar', category: 'Hobbies', icon: 'musical-note', color: '#8910b9' },
    { id: '48', title: 'Piano', category: 'Hobbies', icon: 'musical-note', color: '#8910b9' },
    { id: '49', title: 'Violin', category: 'Hobbies', icon: 'musical-note', color: '#8910b9' },

    // SOCIAL
    { id: '50', title: 'Volunteering', category: 'Social', icon: 'heart-half', color: '#10B981' },
    { id: '51', title: 'Networking', category: 'Social', icon: 'chatbubbles', color: '#10B981' },
    { id: '52', title: 'Career Fairs', category: 'Social', icon: 'briefcase', color: '#10B981' },
    { id: '53', title: 'Workshops', category: 'Social', icon: 'construct', color: '#10B981' },
    { id: '54', title: 'Board Games', category: 'Social', icon: 'dice', color: '#10B981' },
];

export const getCategoryForTag = (tagTitle: string): string => {
    const tag = INTEREST_TAGS.find(t => t.title === tagTitle);
    return tag?.category || 'Social';
};

export const getColorForTag = (tagTitle: string): string => {
    const tag = INTEREST_TAGS.find(t => t.title === tagTitle);
    return tag?.color || '#10B981';
};

export const getColorForCategory = (categoryName: string): string => {
    return CATEGORY_COLORS[categoryName] || '#10B981';
};
