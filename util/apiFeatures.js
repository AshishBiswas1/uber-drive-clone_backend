// util/apiFeatures.js
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // 1) FILTERING
  filter() {
    // Create a hard copy of the query object
    const queryObj = { ...this.queryString };

    // Exclude special fields that are not for filtering
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Advanced filtering for operators (gte, gt, lte, lt, in, nin)
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gte|gt|lte|lt|in|nin|ne|regex)\b/g,
      (match) => `$${match}`
    );

    // Apply the filter to the query
    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  // 2) TEXT SEARCH
  search() {
    if (this.queryString.search) {
      // For text search across multiple fields
      const searchRegex = new RegExp(this.queryString.search, 'i');

      // Define searchable fields based on the model
      // This can be customized per model
      this.query = this.query.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { comment: searchRegex },
          { 'pickupLocation.address': searchRegex },
          { 'dropoffLocation.address': searchRegex },
        ],
      });
    }

    return this;
  }

  // 3) SORTING
  sort() {
    if (this.queryString.sort) {
      // Allow multiple sort fields separated by comma
      // Example: ?sort=-rating,createdAt
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      // Default sort by newest first
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  // 4) FIELD LIMITING (PROJECTION)
  limitFields() {
    if (this.queryString.fields) {
      // Select only specified fields
      // Example: ?fields=name,email,rating
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      // Exclude version field by default
      this.query = this.query.select('-__v');
    }

    return this;
  }

  // 5) PAGINATION
  paginate() {
    const page = this.queryString.page * 1 || 1; // Convert to number, default 1
    const limit = this.queryString.limit * 1 || 100; // Convert to number, default 100
    const skip = (page - 1) * limit;

    // Apply skip and limit
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  // 6) DATE RANGE FILTERING
  dateRange() {
    if (this.queryString.startDate || this.queryString.endDate) {
      const dateFilter = {};

      if (this.queryString.startDate) {
        dateFilter.$gte = new Date(this.queryString.startDate);
      }

      if (this.queryString.endDate) {
        // Add 23:59:59 to include the entire end date
        const endDate = new Date(this.queryString.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }

      this.query = this.query.find({ createdAt: dateFilter });
    }

    return this;
  }

  // 7) POPULATE FIELDS (Optional)
  populate(populateOptions) {
    if (populateOptions && Array.isArray(populateOptions)) {
      populateOptions.forEach((option) => {
        this.query = this.query.populate(option);
      });
    } else if (populateOptions) {
      this.query = this.query.populate(populateOptions);
    }

    return this;
  }

  // 8) COUNT DOCUMENTS (for pagination info)
  async getCount() {
    // Clone the query to count documents
    const countQuery = this.query.model.find(this.query.getQuery());
    return await countQuery.countDocuments();
  }

  // 9) EXECUTE QUERY
  async execute() {
    return await this.query;
  }
}

module.exports = APIFeatures;
